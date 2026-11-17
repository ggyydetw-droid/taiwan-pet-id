import Link from "next/link";
import "./globals.css";
export const metadata={title:"Taiwan Pet ID"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-Hant"><body><header><Link href="/">🐾 Taiwan Pet ID</Link><nav><Link href="/owner">Owner</Link><Link href="/clinic">Clinic</Link></nav></header>{children}</body></html>}