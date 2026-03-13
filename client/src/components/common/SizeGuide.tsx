import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SizeGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const tabs = ['Tops', 'Bottoms'] as const;
type Tab = (typeof tabs)[number];

const topsData = [
  { size: 'S', chest: '36" / 91cm', waist: '30" / 76cm', hips: '37" / 94cm', length: '27" / 69cm' },
  { size: 'M', chest: '38" / 97cm', waist: '32" / 81cm', hips: '39" / 99cm', length: '28" / 71cm' },
  { size: 'L', chest: '41" / 104cm', waist: '34" / 86cm', hips: '41" / 104cm', length: '29" / 74cm' },
  { size: 'XL', chest: '44" / 112cm', waist: '37" / 94cm', hips: '44" / 112cm', length: '30" / 76cm' },
];

const bottomsData = [
  { size: 'S', waist: '28" / 71cm', hips: '37" / 94cm', inseam: '30" / 76cm', length: '39" / 99cm' },
  { size: 'M', waist: '30" / 76cm', hips: '39" / 99cm', inseam: '31" / 79cm', length: '40" / 102cm' },
  { size: 'L', waist: '33" / 84cm', hips: '41" / 104cm', inseam: '32" / 81cm', length: '41" / 104cm' },
  { size: 'XL', waist: '36" / 91cm', hips: '44" / 112cm', inseam: '32" / 81cm', length: '42" / 107cm' },
];

export function SizeGuide({ isOpen, onClose }: SizeGuideProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Tops');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto bg-white shadow-xl"
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-5">
                <h2 className="font-display text-lg font-medium text-neutral-900">
                  Size Guide
                </h2>
                <button
                  onClick={onClose}
                  className="text-neutral-400 transition-colors hover:text-neutral-900"
                  aria-label="Close size guide"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-neutral-100">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'relative flex-1 py-3 text-xs font-medium tracking-widest uppercase transition-colors',
                      activeTab === tab
                        ? 'text-neutral-900'
                        : 'text-neutral-400 hover:text-neutral-600',
                    )}
                  >
                    {tab}
                    {activeTab === tab && (
                      <motion.div
                        layoutId="sizeGuideTab"
                        className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#c8a97e]"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Table */}
              <div className="px-6 py-6">
                {activeTab === 'Tops' ? (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 text-xs font-medium tracking-wider text-neutral-500 uppercase">
                        <th className="pb-3 pr-4">Size</th>
                        <th className="pb-3 pr-4">Chest</th>
                        <th className="pb-3 pr-4">Waist</th>
                        <th className="pb-3 pr-4">Hips</th>
                        <th className="pb-3">Length</th>
                      </tr>
                    </thead>
                    <tbody className="text-neutral-700">
                      {topsData.map((row) => (
                        <tr key={row.size} className="border-b border-neutral-50">
                          <td className="py-3 pr-4 font-medium text-neutral-900">{row.size}</td>
                          <td className="py-3 pr-4">{row.chest}</td>
                          <td className="py-3 pr-4">{row.waist}</td>
                          <td className="py-3 pr-4">{row.hips}</td>
                          <td className="py-3">{row.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 text-xs font-medium tracking-wider text-neutral-500 uppercase">
                        <th className="pb-3 pr-4">Size</th>
                        <th className="pb-3 pr-4">Waist</th>
                        <th className="pb-3 pr-4">Hips</th>
                        <th className="pb-3 pr-4">Inseam</th>
                        <th className="pb-3">Length</th>
                      </tr>
                    </thead>
                    <tbody className="text-neutral-700">
                      {bottomsData.map((row) => (
                        <tr key={row.size} className="border-b border-neutral-50">
                          <td className="py-3 pr-4 font-medium text-neutral-900">{row.size}</td>
                          <td className="py-3 pr-4">{row.waist}</td>
                          <td className="py-3 pr-4">{row.hips}</td>
                          <td className="py-3 pr-4">{row.inseam}</td>
                          <td className="py-3">{row.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* How to Measure */}
                <div className="mt-8 border-t border-neutral-100 pt-6">
                  <h3 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
                    How to Measure
                  </h3>
                  <ul className="mt-4 space-y-2 text-sm leading-relaxed text-neutral-600">
                    <li>
                      <span className="font-medium text-neutral-800">Chest:</span> Measure around
                      the fullest part of your chest, keeping the tape level.
                    </li>
                    <li>
                      <span className="font-medium text-neutral-800">Waist:</span> Measure around
                      your natural waistline, just above the hip bone.
                    </li>
                    <li>
                      <span className="font-medium text-neutral-800">Hips:</span> Stand with feet
                      together and measure around the fullest part of your hips.
                    </li>
                    <li>
                      <span className="font-medium text-neutral-800">Inseam:</span> Measure from
                      the crotch seam to the bottom of the leg.
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
