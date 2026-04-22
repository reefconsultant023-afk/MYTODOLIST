import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  BrainCircuit, 
  Sparkles, 
  History, 
  Filter,
  MoreVertical,
  X,
  Target,
  Zap,
  Coffee,
  Bookmark,
  PencilLine,
  Check,
  LogOut,
  LogIn,
  Calendar as CalendarIcon,
  LayoutGrid,
  ChevronRight,
  ChevronLeft,
  Clock
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  User 
} from './lib/firebase';

interface SubTask {
  id: string;
  text: string;
  completed: boolean;
}

interface Task {
  id: string;
  text: string;
  category: 'urgent_important' | 'urgent_not_important' | 'not_urgent_important' | 'not_urgent_not_important';
  completed: boolean;
  createdAt: number;
  date?: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  userId: string;
  subTasks?: SubTask[];
}

const CATEGORIES = [
  { id: 'urgent_important', name: 'عاجل مهم', icon: Zap, color: 'text-rose-600', bg: 'bg-rose-50' },
  { id: 'not_urgent_important', name: 'غير عاجل مهم', icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'urgent_not_important', name: 'عاجل غير مهم', icon: Coffee, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'not_urgent_not_important', name: 'غير عاجل غير مهم', icon: BrainCircuit, color: 'text-slate-500', bg: 'bg-slate-50' },
] as const;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState<Task['category']>('urgent_important');
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [editingStartTime, setEditingStartTime] = useState('');
  const [editingEndTime, setEditingEndTime] = useState('');
  const [editingDate, setEditingDate] = useState('');
  const [editingCategory, setEditingCategory] = useState<Task['category'] | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [subTaskInputs, setSubTaskInputs] = useState<Record<string, string>>({});

  // Handle Authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const safeFormatDate = (dateStr: string | undefined, options: Intl.DateTimeFormatOptions) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return new Intl.DateTimeFormat('ar-EG', options).format(d);
    } catch (e) {
      return '';
    }
  };

  // Sync with Firestore
  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }

    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList: Task[] = [];
      snapshot.forEach((doc) => {
        taskList.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(taskList);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-blocked') {
        alert('يرجى تفعيل النوافذ المنبثقة (Popups) في إعدادات المتصفح لتتمكن من تسجيل الدخول.');
      }
    }
  };

  const handleLogout = () => signOut(auth);

  const addTask = useCallback(async () => {
    if (!inputValue.trim() || !user) return;

    const taskId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const newTask: Omit<Task, 'id'> = {
      text: inputValue.trim(),
      category: selectedCategory,
      completed: false,
      createdAt: Date.now(),
      date: viewMode === 'calendar' ? selectedDate : new Date().toISOString().split('T')[0],
      startTime: startTime || "",
      endTime: endTime || "",
      userId: user.uid,
    };

    try {
      await setDoc(doc(db, 'tasks', taskId), newTask);
      setInputValue('');
      setStartTime('');
      setEndTime('');
    } catch (error) {
      console.error("Error adding task", error);
    }
  }, [inputValue, selectedCategory, startTime, endTime, user]);

  const toggleTask = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'tasks', id), { completed: !currentStatus });
    } catch (error) {
      console.error("Error toggling task", error);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      console.error("Error deleting task", error);
    }
  };

  const deleteSubTask = async (taskId: string, subTaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subTasks) return;

    try {
      const updatedSubTasks = task.subTasks.filter(st => st.id !== subTaskId);
      await updateDoc(doc(db, 'tasks', taskId), { subTasks: updatedSubTasks });
    } catch (error) {
      console.error("Error deleting subtask", error);
    }
  };

  const toggleSubTask = async (taskId: string, subTaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subTasks) return;

    try {
      const updatedSubTasks = task.subTasks.map(st => 
        st.id === subTaskId ? { ...st, completed: !st.completed } : st
      );
      await updateDoc(doc(db, 'tasks', taskId), { subTasks: updatedSubTasks });
    } catch (error) {
      console.error("Error toggling subtask", error);
    }
  };

  const addSubTask = async (taskId: string) => {
    const text = subTaskInputs[taskId];
    if (!text?.trim()) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      const newSubTask: SubTask = {
        id: Math.random().toString(36).substring(2, 9),
        text: text.trim(),
        completed: false
      };

      const updatedSubTasks = [...(task.subTasks || []), newSubTask];
      await updateDoc(doc(db, 'tasks', taskId), { subTasks: updatedSubTasks });
      setSubTaskInputs(prev => ({ ...prev, [taskId]: '' }));
    } catch (error) {
      console.error("Error adding subtask", error);
    }
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingText(task.text);
    setEditingStartTime(task.startTime || '');
    setEditingEndTime(task.endTime || '');
    setEditingDate(task.date || '');
    setEditingCategory(task.category);
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditingText('');
    setEditingStartTime('');
    setEditingEndTime('');
    setEditingDate('');
    setEditingCategory(null);
  };

  const updateTask = async () => {
    if (!editingTaskId || !editingText.trim() || !editingCategory || !editingDate) return;
    
    try {
      await updateDoc(doc(db, 'tasks', editingTaskId), { 
        text: editingText.trim(),
        startTime: editingStartTime || "",
        endTime: editingEndTime || "",
        date: editingDate,
        category: editingCategory
      });
      setEditingTaskId(null);
      setEditingText('');
      setEditingStartTime('');
      setEditingEndTime('');
      setEditingDate('');
      setEditingCategory(null);
    } catch (error) {
      console.error("Error updating task", error);
    }
  };

  const clearCompleted = async () => {
    const completedTasks = tasks.filter(t => t.completed);
    for (const task of completedTasks) {
      await deleteTask(task.id);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (viewMode === 'calendar') {
      return t.date === selectedDate;
    }
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return !t.completed;
    if (activeTab === 'completed') return t.completed;
    return t.category === activeTab;
  }).sort((a, b) => {
    if (viewMode === 'calendar' && a.startTime && b.startTime) {
      return a.startTime.localeCompare(b.startTime);
    }
    return b.createdAt - a.createdAt;
  });

  const today = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const generateDays = () => {
    const todayDate = new Date();
    const days = [];
    for (let i = -7; i <= 21; i++) {
      const d = new Date();
      d.setDate(todayDate.getDate() + i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  };

  if (!isLoaded) return null;

  if (!user) {
    return (
    <div className="min-h-dvh bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-right" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 space-y-8 flex flex-col items-center"
        >
          <div className="w-20 h-20 bg-[#F1F5F9] rounded-2xl flex items-center justify-center text-[#0F172A]">
            <BrainCircuit size={40} />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-[#0F172A] font-heading leading-tight">تدفق الأفكار</h1>
            <p className="text-[#64748B]">سجل دخولك لحفظ مهامك والوصول إليها من أي مكان</p>
          </div>
          <Button 
            onClick={handleLogin}
            className="w-full bg-[#0F172A] hover:bg-[#1e293b] text-white h-14 rounded-2xl text-lg font-medium shadow-lg transition-all"
          >
            <LogIn className="ml-2 w-5 h-5" />
            الدخول باستخدام Google
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFC] text-[#1E293B] font-sans selection:bg-slate-200" dir="rtl">
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-20 flex flex-col min-h-dvh">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-bold text-[#0F172A] tracking-tight font-heading">
              {viewMode === 'calendar' ? 'جدول المواعيد' : 'مساحة التفريغ الذهني'}
            </h1>
            <p className="text-[#64748B] text-base md:text-lg">
              {viewMode === 'calendar' 
                ? `مهام يوم ${safeFormatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}`
                : `أهلاً ${user.displayName}، اليوم هو ${today}`
              }
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setViewMode(viewMode === 'grid' ? 'calendar' : 'grid')}
              className="border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] rounded-full px-4 h-10 transition-all font-medium"
            >
              {viewMode === 'grid' ? (
                <><CalendarIcon className="ml-2 w-4 h-4" /> التقويم</>
              ) : (
                <><LayoutGrid className="ml-2 w-4 h-4" /> مصفوفة</>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] rounded-full px-4 h-10 transition-all font-medium"
            >
              <LogOut className="ml-2 w-4 h-4" /> خروج
            </Button>
            <div className="hidden md:block">
              <Badge className="bg-[#0F172A] text-white hover:bg-[#0F172A] border-none px-4 py-2 rounded-full text-sm font-medium transition-all">
                جلسة جديدة
              </Badge>
            </div>
          </div>
        </header>

        {/* Input Area */}
        <div className="mb-16 space-y-4">
          {viewMode === 'calendar' && (
            <div className="flex flex-col gap-4 mb-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <Clock className="w-4 h-4" /> الجدول الزمني لليوم
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                  className="text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold"
                >
                  العودة لليوم
                </Button>
              </div>
              <div className="flex items-center gap-2 text-[#64748B] overflow-x-auto no-scrollbar pb-2 touch-pan-x">
                {generateDays().map((dayStr) => {
                  const d = new Date(dayStr);
                  const isSelected = selectedDate === dayStr;
                  const isToday = new Date().toISOString().split('T')[0] === dayStr;
                  
                  return (
                    <button
                      key={dayStr}
                      onClick={() => setSelectedDate(dayStr)}
                      className={cn(
                        "flex flex-col items-center justify-center min-w-[60px] h-20 rounded-2xl transition-all border",
                        isSelected 
                          ? "bg-[#0F172A] text-white border-[#0F172A] shadow-lg scale-105" 
                          : "bg-white text-[#64748B] border-[#F1F5F9] hover:border-[#E2E8F0]"
                      )}
                    >
                      <span className="text-[10px] opacity-70 mb-1">
                        {new Intl.DateTimeFormat('ar-EG', { weekday: 'short' }).format(d)}
                      </span>
                      <span className="text-xl font-bold">{d.getDate()}</span>
                      {isToday && !isSelected && <div className="w-1 h-1 bg-[#0F172A] rounded-full mt-1" />}
                    </button>
                  );
                })}
              </div>
              <div className="text-center">
                <span className="text-sm font-bold text-[#0F172A]">
                  {safeFormatDate(selectedDate, { dateStyle: 'full' })}
                </span>
              </div>
            </div>
          )}

          <div className="relative group">
            <input
              type="text"
              placeholder="ماذا يدور في ذهنك الآن؟ اكتبه هنا لترتاح..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              autoFocus
              className="w-full bg-transparent border-none border-b-2 border-[#E2E8F0] focus:border-[#0F172A] text-2xl md:text-3xl py-4 outline-none text-[#334155] transition-colors placeholder:text-[#CBD5E1] placeholder:font-light"
            />
            <Button 
              onClick={addTask}
              variant="ghost"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 text-[#CBD5E1] hover:text-[#0F172A] transition-colors"
            >
              <Plus className="w-8 h-8" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-[#64748B]">
              <span className="text-sm font-medium">الوقت:</span>
              <div className="flex items-center bg-white border border-[#E2E8F0] rounded-lg px-2 py-1 gap-2">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-[#334155]"
                />
                <span className="text-xs">إلى</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-[#334155]"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase transition-all border",
                    selectedCategory === cat.id 
                      ? "bg-[#0F172A] text-white border-[#0F172A]" 
                      : "bg-white text-[#94A3B8] border-[#F1F5F9] hover:border-[#E2E8F0]"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tasks Grid */}
        <div className="flex-grow space-y-8">
           <div className="flex flex-col gap-4 border-b border-[#E2E8F0] pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Filter className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">تصفية حسب:</span>
                </div>
                <Button 
                  variant="link" 
                  onClick={clearCompleted}
                  className="text-[#64748B] p-0 h-auto hover:text-rose-600 transition-colors text-xs font-bold"
                >
                  مسح المكتمل
                </Button>
              </div>

              <div className="overflow-x-auto no-scrollbar -mx-6 px-6 touch-pan-x">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="bg-transparent h-auto p-0 gap-6 flex">
                    {[
                      { id: 'all', name: 'الكل' },
                      { id: 'active', name: 'نشط' },
                      { id: 'completed', name: 'مكتمل' },
                      ...CATEGORIES
                    ].map((item) => (
                      <TabsTrigger 
                        key={item.id} 
                        value={item.id} 
                        className="bg-transparent p-0 text-[#64748B] data-[state=active]:text-[#0F172A] data-[state=active]:font-bold data-[state=active]:bg-transparent relative h-10 whitespace-nowrap text-sm after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 data-[state=active]:after:bg-[#0F172A] transition-all"
                      >
                        {item.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
              <AnimatePresence initial={false} mode="popLayout">
                {filteredTasks.length > 0 ? (
                  filteredTasks.map((task) => {
                    const CategoryInfo = CATEGORIES.find(c => c.id === task.category) || CATEGORIES[0];
                    const isEditing = editingTaskId === task.id;

                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group"
                      >
                        <Card className="h-full border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.05)] rounded-2xl flex flex-col group-hover:shadow-lg transition-all duration-300">
                          <CardContent className="p-6 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-[11px] uppercase tracking-widest text-[#94A3B8] font-bold">
                                  {CategoryInfo.name}
                                </span>
                                {viewMode === 'calendar' && task.startTime && (
                                  <div className="flex items-center gap-1.5 text-[#0F172A] font-bold text-sm bg-indigo-50 w-fit px-2 py-0.5 rounded-lg border border-indigo-100">
                                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>{task.startTime}</span>
                                    {task.endTime && <span className="opacity-40">- {task.endTime}</span>}
                                  </div>
                                )}
                              </div>
                                <div className="flex gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  {!isEditing && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => startEditing(task)}
                                      className="h-9 w-9 text-[#94A3B8] hover:text-[#0F172A] hover:bg-slate-100 rounded-full transition-colors"
                                    >
                                      <PencilLine className="w-4.5 h-4.5" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => toggleTask(task.id, task.completed)}
                                    className={cn(
                                      "h-9 w-9 rounded-full transition-colors",
                                      task.completed ? "text-emerald-600 bg-emerald-50" : "text-[#94A3B8] hover:text-emerald-600 hover:bg-emerald-50"
                                    )}
                                  >
                                    <CheckCircle2 className="w-4.5 h-4.5" />
                                  </Button>
                                  {!deletingTaskId || deletingTaskId !== task.id ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setDeletingTaskId(task.id)}
                                      className="h-9 w-9 text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
                                    >
                                      <Trash2 className="w-4.5 h-4.5" />
                                    </Button>
                                  ) : (
                                    <div className="flex items-center gap-1 bg-rose-50 rounded-full px-2 py-1 animate-in fade-in slide-in-from-right-1">
                                      <span className="text-[10px] font-bold text-rose-600 px-1">حذف؟</span>
                                      <button 
                                        onClick={() => {
                                          deleteTask(task.id);
                                          setDeletingTaskId(null);
                                        }}
                                        className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded-full hover:bg-rose-700 transition-colors"
                                      >
                                        نعم
                                      </button>
                                      <button 
                                        onClick={() => setDeletingTaskId(null)}
                                        className="text-[10px] text-[#64748B] px-1 hover:text-[#0F172A]"
                                      >
                                        لا
                                      </button>
                                    </div>
                                  )}
                                </div>
                            </div>
                            
                            {isEditing ? (
                              <div className="flex flex-col gap-3 mb-8">
                                <textarea
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  autoFocus
                                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-lg text-[#334155] outline-none focus:border-[#0F172A] resize-none"
                                  rows={3}
                                />
                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 py-1">
                                    <input
                                      type="time"
                                      value={editingStartTime}
                                      onChange={(e) => setEditingStartTime(e.target.value)}
                                      className="bg-transparent border-none outline-none text-xs text-[#334155]"
                                    />
                                    <span className="text-xs">إلى</span>
                                    <input
                                      type="time"
                                      value={editingEndTime}
                                      onChange={(e) => setEditingEndTime(e.target.value)}
                                      className="bg-transparent border-none outline-none text-xs text-[#334155]"
                                    />
                                  </div>
                                  <div className="flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 py-1">
                                    <input
                                      type="date"
                                      value={editingDate}
                                      onChange={(e) => setEditingDate(e.target.value)}
                                      className="bg-transparent border-none outline-none text-xs text-[#334155] font-bold"
                                    />
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {CATEGORIES.map((cat) => (
                                    <button
                                      key={cat.id}
                                      onClick={() => setEditingCategory(cat.id)}
                                      className={cn(
                                        "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase transition-all border",
                                        editingCategory === cat.id 
                                          ? "bg-[#0F172A] text-white border-[#0F172A]" 
                                          : "bg-white text-[#94A3B8] border-[#F1F5F9] hover:border-[#E2E8F0]"
                                      )}
                                    >
                                      {cat.name}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={updateTask} className="bg-[#0F172A] text-white">
                                    <Check className="w-4 h-4 ml-2" /> حفظ
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={cancelEditing}>إلغاء</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3 mb-8">
                                {(task.startTime || task.endTime) && (
                                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#0F172A]/60 bg-slate-100/50 w-fit px-2 py-0.5 rounded-md">
                                    <span>{task.startTime || "--:--"}</span>
                                    <span>←</span>
                                    <span>{task.endTime || "--:--"}</span>
                                  </div>
                                )}
                                <p className={cn(
                                  "text-lg text-[#334155] leading-relaxed",
                                  task.completed && "text-[#CBD5E1] line-through decoration-2"
                                )}>
                                  {task.text}
                                </p>

                                {/* Subtasks Section */}
                                <div className="mt-4 space-y-3">
                                  <div className="flex flex-col gap-2">
                                    {(task.subTasks || []).map((st) => (
                                      <div key={st.id} className="flex items-center group/subtask gap-2 bg-[#F8FAFC]/50 p-2 rounded-lg hover:bg-[#F1F5F9] transition-colors">
                                        <button 
                                          onClick={() => toggleSubTask(task.id, st.id)}
                                          className={cn(
                                            "flex-shrink-0 transition-colors",
                                            st.completed ? "text-emerald-500" : "text-[#94A3B8] hover:text-emerald-400"
                                          )}
                                        >
                                          {st.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                        </button>
                                        <span className={cn(
                                          "text-sm flex-grow",
                                          st.completed ? "text-[#CBD5E1] line-through" : "text-[#475569]"
                                        )}>
                                          {st.text}
                                        </span>
                                        <button 
                                          onClick={() => deleteSubTask(task.id, st.id)}
                                          className="opacity-0 group-hover/subtask:opacity-100 text-[#94A3B8] hover:text-rose-500 transition-all p-1"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  
                                  <div className="relative pt-1">
                                    <input
                                      type="text"
                                      placeholder="أضف مهمة صغيرة..."
                                      value={subTaskInputs[task.id] || ''}
                                      onChange={(e) => setSubTaskInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                                      onKeyDown={(e) => e.key === 'Enter' && addSubTask(task.id)}
                                      className="w-full bg-transparent border-none border-b border-[#E2E8F0] focus:border-[#0F172A] text-sm py-2 outline-none text-[#475569] transition-colors placeholder:text-[#CBD5E1]"
                                    />
                                    <button 
                                      onClick={() => addSubTask(task.id)}
                                      className="absolute left-0 top-1/2 -translate-y-1/2 text-[#CBD5E1] hover:text-[#0F172A] p-1"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <div className="mt-auto pt-4 flex justify-between items-center text-[13px] text-[#94A3B8]">
                              <div className="flex flex-col gap-0.5">
                                <span>منذ {Math.floor((Date.now() - task.createdAt) / 60000)} دقيقة</span>
                                {task.date && task.date !== todayStr && (
                                  <span className="text-[10px] font-bold text-indigo-500">
                                    {safeFormatDate(task.date, { dateStyle: 'medium' })}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center">
                                <span className={cn(
                                  "w-2 h-2 rounded-full ml-2",
                                  task.completed ? "bg-[#10B981]" : "bg-[#3B82F6]"
                                )} />
                                {task.completed ? "تم الحفظ" : "قيد الانتظار"}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-20 text-center bg-white/40 rounded-3xl border-2 border-dashed border-slate-100">
                    <p className="text-[#CBD5E1] text-lg">
                      {viewMode === 'calendar' 
                        ? 'لا توجد مهام مجدولة لهذا اليوم...'
                        : 'لا توجد مهام حالياً...'}
                    </p>
                    {viewMode === 'calendar' && (
                      <p className="text-sm text-slate-400 mt-2">اكتب مهمة جديدة بالأعلى لتنظيم يومك</p>
                    )}
                  </div>
                )}
              </AnimatePresence>
           </div>
        </div>

        {/* Sidebar Stats */}
        <footer className="mt-auto pt-10 border-t border-[#E2E8F0] grid grid-cols-2 md:flex md:gap-16 gap-8">
          <div className="flex flex-col">
            <span className="text-2xl md:text-3xl font-semibold text-[#0F172A]">{tasks.length}</span>
            <span className="text-sm text-[#64748B]">مهام تم تفريغها</span>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl md:text-3xl font-semibold text-[#0F172A]">
               {tasks.length > 0 ? Math.floor(tasks.filter(t => t.completed).length / tasks.length * 100) : 0}%
            </span>
            <span className="text-sm text-[#64748B]">مستوى صفاء الذهن</span>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl md:text-3xl font-semibold text-[#0F172A]">
              {tasks.filter(t => !t.completed).length}
            </span>
            <span className="text-sm text-[#64748B]">أفكار نشطة</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
