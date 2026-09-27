package main

import (
	"crypto/x509"
	"net/http/httptest"
	"testing"
)

func TestCertificateAndDestination(t *testing.T) {
	cert, root, err := certificate()
	if err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(root) {
		t.Fatal("missing root")
	}
	leaf, err := x509.ParseCertificate(cert.Certificate[0])
	if err != nil {
		t.Fatal(err)
	}
	if _, err = leaf.Verify(x509.VerifyOptions{Roots: roots, DNSName: "api.deepseek.com"}); err != nil {
		t.Fatal(err)
	}
	if _, err = leaf.Verify(x509.VerifyOptions{Roots: roots, DNSName: "example.com"}); err == nil {
		t.Fatal("unexpected domain trusted")
	}
	for _, target := range []string{"example.com:443", "169.254.169.254:80", "api.deepseek.com:80"} {
		request := httptest.NewRequest("CONNECT", "http://"+target, nil)
		request.Host = target
		response := httptest.NewRecorder()
		handler(cert).ServeHTTP(response, request)
		if response.Code != 403 {
			t.Fatalf("%s: %d", target, response.Code)
		}
	}
}
