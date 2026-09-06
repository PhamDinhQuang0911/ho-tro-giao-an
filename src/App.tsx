/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScheduleSettings } from '@/components/ScheduleSettings';
import { UserGuide } from '@/components/UserGuide';
import { LessonPlanProcessor } from '@/components/LessonPlanProcessor';
import { ScheduleBuilder } from '@/features/TeachingSchedule/ui/ScheduleBuilder';
import { Toaster } from '@/components/ui/sonner';
import { BookOpen, Settings, FileText, HelpCircle, CalendarRange, Coffee, Youtube } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { CoffeeModal } from '@/components/CoffeeModal';
import { Button } from '@/components/ui/button';

export default function App() {
  const [activeTab, setActiveTab] = React.useState('processor');
  const [showCoffeeModal, setShowCoffeeModal] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans relative">
      <div className="max-w-6xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <BookOpen className="w-10 h-10 text-primary" />
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mb-3">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Hỗ trợ Soạn giáo án
            </h1>
            <div className="hidden sm:block w-px h-8 bg-slate-300"></div>
            <div className="text-left text-sm text-slate-500">
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400">Tác giả</span>
              <span className="font-medium text-slate-700">Phạm Đình Quang<br/><span className="text-xs text-slate-500 font-normal">THCS Đường Hào Phân hiệu 4</span></span>
            </div>
            <div className="hidden sm:block w-px h-8 bg-slate-300"></div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCoffeeModal(true)}
              className="bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300/90 font-semibold shadow-sm transition-all flex items-center gap-1.5 rounded-full px-3.5 py-1.5 hover:scale-105"
            >
              <Coffee className="w-4 h-4 text-amber-600 animate-pulse" />
              Mời tác giả 1 ly cafe
            </Button>
          </div>
          <p className="text-lg text-slate-600 mb-4">
            Tự động hóa việc điền thông tin tuần, tiết và ngày giảng vào giáo án Word.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://youtu.be/hr-jLaG35hM"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold shadow-sm transition-all hover:scale-105"
            >
              <Youtube className="w-4 h-4 text-red-600" />
              Video HD Soạn giáo án
            </a>
            <a
              href="https://youtu.be/MaOHaPQF4rg"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold shadow-sm transition-all hover:scale-105"
            >
              <Youtube className="w-4 h-4 text-red-600" />
              Video HD Báo giảng
            </a>
          </div>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="flex w-full border-b mb-8 bg-transparent p-0 overflow-x-auto">
            <TabsTrigger value="processor" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent text-slate-500 font-medium py-3 data-[state=active]:shadow-none transition-colors whitespace-nowrap">
              <FileText className="w-4 h-4 mr-2" />
              Soạn giáo án
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent text-slate-500 font-medium py-3 data-[state=active]:shadow-none transition-colors whitespace-nowrap">
              <CalendarRange className="w-4 h-4 mr-2" />
              Tạo Lịch Báo Giảng
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent text-slate-500 font-medium py-3 data-[state=active]:shadow-none transition-colors whitespace-nowrap">
              <Settings className="w-4 h-4 mr-2" />
              Cài đặt lịch
            </TabsTrigger>
            <TabsTrigger value="guide" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent text-slate-500 font-medium py-3 data-[state=active]:shadow-none transition-colors whitespace-nowrap">
              <HelpCircle className="w-4 h-4 mr-2" />
              Hướng dẫn
            </TabsTrigger>
          </TabsList>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Use custom display logic to preserve state instead of TabsContent which unmounts */}
            <div className={cn(activeTab !== 'processor' && "hidden")}>
              <LessonPlanProcessor />
            </div>
            <div className={cn(activeTab !== 'schedule' && "hidden")}>
              <ScheduleBuilder />
            </div>
            <div className={cn(activeTab !== 'settings' && "hidden")}>
              <ScheduleSettings />
            </div>
            <div className={cn(activeTab !== 'guide' && "hidden")}>
              <UserGuide />
            </div>

          </motion.div>
        </Tabs>
      </div>

      <CoffeeModal open={showCoffeeModal} onOpenChange={setShowCoffeeModal} />
      <Toaster position="top-center" richColors />
    </div>
  );
}

