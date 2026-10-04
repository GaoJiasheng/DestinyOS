'use client';
import { motion, useReducedMotion } from 'motion/react';
/** Thirty-six transform-only proxies keep the deck inexpensive on mobile. */
export function TarotDeck({ shuffles = 0 }: { shuffles?: number }) {
  const reduced = useReducedMotion();
  return (
    <div className="tarot-deck" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <motion.div
          key={i}
          className="tarot-deck-proxy"
          animate={{
            x: reduced ? 0 : shuffles ? ((i * 13 + shuffles * 17) % 45) - 22 : i % 4,
            y: (i % 5) - 2,
            rotate: reduced ? 0 : shuffles ? ((i * 7 + shuffles) % 17) - 8 : 0,
          }}
          transition={{ duration: reduced ? 0.15 : 0.6 }}
        />
      ))}
    </div>
  );
}
