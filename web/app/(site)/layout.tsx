import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { WalletProvider } from '@/components/Wallet';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
    </WalletProvider>
  );
}
