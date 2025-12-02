import { motion } from 'framer-motion';

/**
 * PageTransition wrapper component for consistent page animations
 * Wraps page content with Framer Motion animations
 */
export default function PageTransition({ children, className = '' }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
