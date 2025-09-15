import type React from "react"
import "./index.css"

const playfair = Playfair_Display({
    subsets: ["latin", "cyrillic"],
    display: "swap",
    variable: "--font-playfair",
})

const sourceSans = Source_Sans_Pro({
    subsets: ["latin", "cyrillic"],
    weight: ["400", "600", "700"],
    display: "swap",
    variable: "--font-source-sans",
})

export const metadata: Metadata = {
    title: "Baggateria QR Menu",
    description: "Coffee shop menu powered by Google Sheets",
}

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode
}) {
    return (
        <html lang="ru" className={`${playfair.variable} ${sourceSans.variable} antialiased`}>
        <body>{children}</body>
        </html>
    )
}
