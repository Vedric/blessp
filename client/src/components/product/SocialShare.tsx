import { useState } from 'react';
import { motion } from 'framer-motion';
import { Facebook, Link2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SocialShareProps {
  productName: string;
  className?: string;
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function PinterestIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
    </svg>
  );
}

export function SocialShare({ productName, className }: SocialShareProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = window.location.href;
  const shareText = `Check out ${productName} from BLE$$ P`;

  const handleShare = async (platform: string) => {
    // Try native share on mobile first
    if (platform === 'native' && navigator.share) {
      try {
        await navigator.share({ title: productName, text: shareText, url: shareUrl });
        return;
      } catch {
        return;
      }
    }

    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);

    const urls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      x: `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}`,
    };

    if (urls[platform]) {
      window.open(urls[platform], '_blank', 'width=600,height=400,noopener,noreferrer');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const buttons = [
    { id: 'facebook', icon: <Facebook size={15} />, label: 'Facebook' },
    { id: 'x', icon: <XIcon size={14} />, label: 'X' },
    { id: 'pinterest', icon: <PinterestIcon size={15} />, label: 'Pinterest' },
  ];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="text-[10px] font-medium tracking-[0.2em] text-neutral-400 uppercase">
        Share
      </span>
      {buttons.map(({ id, icon, label }) => (
        <motion.button
          key={id}
          onClick={() => handleShare(id)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-400 transition-colors hover:border-[#c8a97e] hover:text-[#c8a97e]"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title={`Share on ${label}`}
          aria-label={`Share on ${label}`}
        >
          {icon}
        </motion.button>
      ))}
      <motion.button
        onClick={handleCopyLink}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
          copied
            ? 'border-[#c8a97e] text-[#c8a97e]'
            : 'border-neutral-200 text-neutral-400 hover:border-[#c8a97e] hover:text-[#c8a97e]',
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        title={copied ? 'Copied!' : 'Copy link'}
        aria-label="Copy link"
      >
        {copied ? <Check size={14} /> : <Link2 size={14} />}
      </motion.button>
      {copied && (
        <motion.span
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          className="text-xs text-[#c8a97e]"
        >
          Copied!
        </motion.span>
      )}
    </div>
  );
}
