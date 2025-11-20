import { motion } from "framer-motion";

export default function Splash() {
  // Shake animation keyframes
  const shakeAnimation = {
    rotate: [0, -10, 10, -10, 10, -5, 5, 0],
    scale: [1, 1.1, 1, 1.05, 1],
  };

  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center">
      <div className="w-full max-w-full mx-auto px-6 flex flex-col items-center text-center">
        <motion.div
          className="text-[10rem] mb-6"
          animate={shakeAnimation}
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
            exit: {
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1], // ease-out cubic bezier
            },
          }}
        >
          🤙
        </motion.div>
        
        <motion.h1
          className="text-3xl font-extrabold tracking-tight"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{
            initial: { duration: 0.5, delay: 0.2 },
            exit: {
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1], // ease-out cubic bezier
            },
          }}
        >
          Sladesh
        </motion.h1>
      </div>
    </div>
  );
}
