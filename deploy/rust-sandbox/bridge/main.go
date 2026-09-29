// 容器内部 HTTPS 适配：仅连接本任务 Unix relay，不拥有外网或真实 Key。
package main

import (
	"bufio"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"os"
	"time"
)

func certificate() (tls.Certificate, []byte, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, nil, err
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return tls.Certificate{}, nil, err
	}
	template := &x509.Certificate{SerialNumber: serial, Subject: pkix.Name{CommonName: "sandbox-local"}, DNSNames: []string{"api.deepseek.com"}, NotBefore: time.Now().Add(-time.Minute), NotAfter: time.Now().Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		return tls.Certificate{}, nil, err
	}
	leaf := *template
	leaf.Subject = pkix.Name{CommonName: "api.deepseek.com"}
	leaf.SerialNumber = new(big.Int).Add(serial, big.NewInt(1))
	leaf.IsCA = false
	leaf.KeyUsage = x509.KeyUsageDigitalSignature
	rootCert, err := x509.ParseCertificate(der)
	if err != nil {
		return tls.Certificate{}, nil, err
	}
	leafKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, nil, err
	}
	leafDER, err := x509.CreateCertificate(rand.Reader, &leaf, rootCert, &leafKey.PublicKey, key)
	if err != nil {
		return tls.Certificate{}, nil, err
	}
	return tls.Certificate{Certificate: [][]byte{leafDER, der}, PrivateKey: leafKey}, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), nil
}

func handler(cert tls.Certificate) http.Handler {
	slots := make(chan struct{}, 8)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodConnect || r.Host != "api.deepseek.com:443" {
			http.Error(w, "destination rejected", 403)
			return
		}
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
		default:
			http.Error(w, "busy", 429)
			return
		}
		conn, _, err := w.(http.Hijacker).Hijack()
		if err != nil {
			return
		}
		defer conn.Close()
		_ = conn.SetDeadline(time.Now().Add(28 * time.Second))
		if _, err = io.WriteString(conn, "HTTP/1.1 200 Connection Established\r\n\r\n"); err != nil {
			return
		}
		secure := tls.Server(conn, &tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS12, NextProtos: []string{"http/1.1"}})
		ctx, cancel := context.WithTimeout(context.Background(), 27*time.Second)
		defer cancel()
		if secure.HandshakeContext(ctx) != nil {
			return
		}
		// 限制解密后的整个请求体积，且只处理一个请求；Key 与调用预算仍由宿主 relay 掌控。
		request, err := http.ReadRequest(bufio.NewReader(io.LimitReader(secure, 12288)))
		if err != nil {
			return
		}
		defer request.Body.Close()
		if request.Method != "POST" || request.Host != "api.deepseek.com" || request.URL.Path != "/responses" || request.URL.RawQuery != "" {
			_, _ = io.WriteString(secure, "HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
			return
		}
		request.URL = &url.URL{Scheme: "http", Host: "api.deepseek.com", Path: "/responses"}
		request.RequestURI = ""
		request.Header.Del("Authorization")
		transport := &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{Timeout: time.Second}).DialContext(ctx, "unix", "/relay/http.sock")
		}, DisableKeepAlives: true, MaxResponseHeaderBytes: 4096}
		defer transport.CloseIdleConnections()
		response, err := transport.RoundTrip(request.WithContext(ctx))
		if err != nil {
			const message = "sandbox relay unavailable\n"
			_, _ = fmt.Fprintf(secure, "HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: %d\r\nConnection: close\r\n\r\n%s", len(message), message)
			return
		}
		defer response.Body.Close()
		response.Close = true
		response.Body = io.NopCloser(io.LimitReader(response.Body, 32768))
		_ = response.Write(secure)
	})
}

func main() {
	cert, root, err := certificate()
	if err != nil {
		panic("local certificate failed")
	}
	listener, err := net.Listen("tcp", "127.0.0.1:18080")
	if err != nil {
		panic("local proxy unavailable")
	}
	if os.WriteFile("/tmp/sandbox-ca.pem", root, 0600) != nil {
		panic("local trust setup failed")
	}
	server := &http.Server{Handler: handler(cert), ReadHeaderTimeout: 2 * time.Second, ReadTimeout: 3 * time.Second, WriteTimeout: 28 * time.Second, MaxHeaderBytes: 4096}
	if err = server.Serve(listener); err != nil {
		fmt.Fprintln(os.Stderr, "local proxy stopped")
		os.Exit(1)
	}
}
