import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Relay — Computer-use automation',
  description: 'Discover, record and replay UI capabilities.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
