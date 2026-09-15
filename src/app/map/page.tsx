'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

export default function MapPage() {
  const [selectedDistrict] = useState('');

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <MapPin size={22} className="text-accent" />
          Bản đồ
        </h1>
        <p className="text-sm text-text-secondary mb-6">
          Xem tất cả quán trên bản đồ Hà Nội
        </p>
      </motion.div>

      {/* Map placeholder - sẽ tích hợp Google Maps sau */}
      <div className="glass-card overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
        <div className="w-full h-full flex flex-col items-center justify-center text-center px-8">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-lg font-bold text-white mb-2">
            Tính năng đang phát triển
          </h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Bản đồ sẽ hiển thị tất cả quán ăn đã review trên Google Maps.
            {selectedDistrict
              ? ` Đang lọc: ${selectedDistrict}`
              : ' Vui lòng quay lại sau!'}
          </p>
          <p className="text-xs text-text-muted mt-4">
            💡 Mẹo: Bạn có thể xem vị trí từng quán bằng link Google Maps trong trang chi tiết
          </p>
        </div>
      </div>
    </div>
  );
}
