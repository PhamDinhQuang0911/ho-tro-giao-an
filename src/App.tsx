/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScheduleSettings } from '@/components/ScheduleSettings';
import { UserGuide } from '@/components/UserGuide';
import { LessonPlanProcessor } from '@/components/LessonPlanProcessor';
import { Toaster } from '@/components/ui/sonner';
import { BookOpen, Settings, FileText, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export default function App() {
  const [activeTab, setActiveTab] = React.useState('processor');

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <BookOpen className="w-10 h-10 text-primary" />
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mb-2">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Hỗ trợ Soạn giáo án
            </h1>
            <div className="hidden sm:block w-px h-8 bg-slate-300"></div>
            <div className="text-left text-sm text-slate-500">
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400">Tác giả</span>
              <span className="font-medium text-slate-700">Phạm Đình Quang<br/><span className="text-xs text-slate-500 font-normal">THCS Đường Hào Phân hiệu 4</span></span>
            </div>
          </div>
          <p className="text-lg text-slate-600">
            Tự động hóa việc điền thông tin tuần, tiết và ngày giảng vào giáo án Word.
          </p>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex justify-center">
                                <TabsList className="flex w-full border-b mb-8 bg-transparent p-0">
            <TabsTrigger value="processor" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent text-slate-500 font-medium py-3 data-[state=active]:shadow-none transition-colors">
              <FileText className="w-4 h-4 mr-2" />
              Soạn giáo án
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent text-slate-500 font-medium py-3 data-[state=active]:shadow-none transition-colors">
              <Settings className="w-4 h-4 mr-2" />
              Cài đặt lịch
            </TabsTrigger>
            <TabsTrigger value="guide" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent text-slate-500 font-medium py-3 data-[state=active]:shadow-none transition-colors">
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
            <div className={cn(activeTab !== 'settings' && "hidden")}>
              <ScheduleSettings />
            </div>
            <div className={cn(activeTab !== 'guide' && "hidden")}>
              <UserGuide />
            </div>

          </motion.div>
        </Tabs>
      </div>

      <Toaster position="top-center" richColors />
    </div>
  );
}

