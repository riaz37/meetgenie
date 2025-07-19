import './global.css';
import { ClerkProvider } from '@clerk/nextjs';

export const metadata = {
  title: 'MeetGenieAI - Intelligent Meeting Assistant',
  description: 'AI-powered meeting transcription, summarization, and Q&A platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
