import { Link } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./DropdownMenu";
import "./NavigationMenu.css";

// 窄屏导航只接收站点入口，路由和业务文案由 AppShell 装配。
export function NavigationMenu({ label, items }: { label: string; items: { to: string; label: string; active: boolean }[] }) {
  return <div className="ui-navigation-menu"><DropdownMenu>
    <DropdownMenuTrigger asChild><button className="ui-navigation-menu__trigger" aria-label={label}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button></DropdownMenuTrigger>
    <DropdownMenuContent className="ui-navigation-menu__content" aria-label={label}>{items.map(item => <DropdownMenuItem asChild key={item.to}><Link to={item.to} aria-current={item.active ? "page" : undefined}>{item.label}{item.active && <svg className="ui-navigation-menu__check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>}</Link></DropdownMenuItem>)}</DropdownMenuContent>
  </DropdownMenu></div>;
}
