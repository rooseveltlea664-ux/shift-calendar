/**
 * 智巡排班 (ShiftMaster) - 核心逻辑控制
 * 支持双人协同排班、共同休息日智能识别、中国法定节假日联动、批量清空与历史回撤、云端跨设备实时自动同步
 */

// 预设默认班次定义 (对齐专业医疗/巡检/工业排班色彩规范)
const DEFAULT_SHIFTS = [
  { id: 'shift_regular', name: '白班', code: '白', startTime: '08:00', endTime: '16:30', hours: 8, color: '#ef4444', textColor: '#ffffff', desc: '常日白班' },
  { id: 'shift_night', name: '夜班', code: '夜', startTime: '20:00', endTime: '次日08:30', hours: 12, color: '#1d4ed8', textColor: '#ffffff', desc: '通宵夜班' },
  { id: 'shift_next_night', name: '下夜', code: '下', startTime: '08:30', endTime: '16:00', hours: 7, color: '#0d9488', textColor: '#ffffff', desc: '下夜班次' },
  { id: 'shift_rest', name: '休息', code: '休', startTime: '00:00', endTime: '00:00', hours: 0, color: '#10b981', textColor: '#ffffff', desc: '轮休/调休' },
  { id: 'shift_middle', name: '中班', code: '中', startTime: '16:00', endTime: '24:00', hours: 8, color: '#f59e0b', textColor: '#ffffff', desc: '下午中班' },
  { id: 'shift_ot', name: '加班', code: '加', startTime: '18:00', endTime: '22:00', hours: 4, color: '#ec4899', textColor: '#ffffff', desc: '额外加班/备勤' },
];

// 预设双人默认身份与配置
const DEFAULT_PERSONS = [
  { id: 'p1', name: '我', badgeColor: '#3b82f6', role: '本人' },
  { id: 'p2', name: 'TA', badgeColor: '#ec4899', role: '伴侣/搭档' }
];

// 预设轮班周期方案
const DEFAULT_ROTATIONS = [
  {
    id: 'rot_4_3',
    name: '四班三倒 (8天周期)',
    desc: '两早两中两夜两休',
    shiftIds: ['shift_morning', 'shift_morning', 'shift_middle', 'shift_middle', 'shift_night', 'shift_night', 'shift_rest', 'shift_rest']
  },
  {
    id: 'rot_2m_2n_2r',
    name: '两早两夜两休 (6天周期)',
    desc: '两早班两夜班两休息',
    shiftIds: ['shift_morning', 'shift_morning', 'shift_night', 'shift_night', 'shift_rest', 'shift_rest']
  },
  {
    id: 'rot_3_shift',
    name: '三班轮倒 (4天周期)',
    desc: '早中夜休顺序轮转',
    shiftIds: ['shift_morning', 'shift_middle', 'shift_night', 'shift_rest']
  },
  {
    id: 'rot_1_work_1_rest',
    name: '做一休一 (2天周期)',
    desc: '上一天班休息一天',
    shiftIds: ['shift_morning', 'shift_rest']
  },
  {
    id: 'rot_standard_5_2',
    name: '标准上五休二 (7天周期)',
    desc: '周一至周五白班，周末双休',
    shiftIds: ['shift_regular', 'shift_regular', 'shift_regular', 'shift_regular', 'shift_regular', 'shift_rest', 'shift_rest']
  }
];

// 快速预设高品质调色盘
const PALETTE_COLORS = [
  '#3b82f6', '#2563eb', '#1d4ed8',
  '#06b6d4', '#0891b2', '#0e7490',
  '#10b981', '#059669', '#047857',
  '#f59e0b', '#d97706', '#b45309',
  '#f97316', '#ea580c', '#c2410c',
  '#8b5cf6', '#7c3aed', '#6d28d9',
  '#ec4899', '#db2777', '#be185d',
  '#ef4444', '#dc2626', '#b91c1c',
  '#64748b', '#475569', '#334155',
];

// 快捷备注标签
const QUICK_NOTES = ['与李工调班', '带新人实操', '临时顶班', '设备大检修', '半天调休', '请假', '培训学习', '晚走1小时'];

// 工具函数：日期格式化 YYYY-MM-DD
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// -------------------------------------------------------------
// 中国法定节假日与调休补班完整权威数据库 (2025、2026年含除夕及假期延长方案)
// isHoliday: true (法定放假日，标记 [休]), false (周末调休补班日，标记 [班])
// -------------------------------------------------------------
const CHINA_HOLIDAYS_DB = {
  // 2025年法定安排
  '2025-01-01': { name: '元旦', isHoliday: true },
  '2025-01-26': { name: '春节调休', isHoliday: false },
  '2025-01-28': { name: '除夕', isHoliday: true },
  '2025-01-29': { name: '春节', isHoliday: true },
  '2025-01-30': { name: '春节', isHoliday: true },
  '2025-01-31': { name: '春节', isHoliday: true },
  '2025-02-01': { name: '春节', isHoliday: true },
  '2025-02-02': { name: '春节', isHoliday: true },
  '2025-02-03': { name: '春节', isHoliday: true },
  '2025-02-04': { name: '春节', isHoliday: true },
  '2025-02-08': { name: '春节调休', isHoliday: false },
  '2025-04-04': { name: '清明节', isHoliday: true },
  '2025-04-05': { name: '清明节', isHoliday: true },
  '2025-04-06': { name: '清明节', isHoliday: true },
  '2025-04-27': { name: '劳动节调休', isHoliday: false },
  '2025-05-01': { name: '劳动节', isHoliday: true },
  '2025-05-02': { name: '劳动节', isHoliday: true },
  '2025-05-03': { name: '劳动节', isHoliday: true },
  '2025-05-04': { name: '劳动节', isHoliday: true },
  '2025-05-05': { name: '劳动节', isHoliday: true },
  '2025-05-31': { name: '端午节', isHoliday: true },
  '2025-06-01': { name: '端午节', isHoliday: true },
  '2025-06-02': { name: '端午节', isHoliday: true },
  '2025-09-28': { name: '国庆调休', isHoliday: false },
  '2025-10-01': { name: '国庆节', isHoliday: true },
  '2025-10-02': { name: '国庆节', isHoliday: true },
  '2025-10-03': { name: '国庆节', isHoliday: true },
  '2025-10-04': { name: '中秋节', isHoliday: true },
  '2025-10-05': { name: '国庆节', isHoliday: true },
  '2025-10-06': { name: '国庆节', isHoliday: true },
  '2025-10-07': { name: '国庆节', isHoliday: true },
  '2025-10-08': { name: '国庆节', isHoliday: true },
  '2025-10-11': { name: '国庆调休', isHoliday: false },

  // 2026年法定安排 (含除夕及五一假期增加1天之优化安排)
  '2026-01-01': { name: '元旦', isHoliday: true },
  '2026-01-02': { name: '元旦', isHoliday: true },
  '2026-01-03': { name: '元旦', isHoliday: true },
  '2026-02-14': { name: '春节调休', isHoliday: false },
  '2026-02-15': { name: '除夕放假', isHoliday: true },
  '2026-02-16': { name: '除夕', isHoliday: true },
  '2026-02-17': { name: '春节', isHoliday: true },
  '2026-02-18': { name: '春节', isHoliday: true },
  '2026-02-19': { name: '春节', isHoliday: true },
  '2026-02-20': { name: '春节', isHoliday: true },
  '2026-02-21': { name: '春节', isHoliday: true },
  '2026-02-22': { name: '春节', isHoliday: true },
  '2026-02-28': { name: '春节调休', isHoliday: false },
  '2026-04-04': { name: '清明节', isHoliday: true },
  '2026-04-05': { name: '清明节', isHoliday: true },
  '2026-04-06': { name: '清明节', isHoliday: true },
  '2026-04-26': { name: '劳动节调休', isHoliday: false },
  '2026-05-01': { name: '劳动节', isHoliday: true },
  '2026-05-02': { name: '劳动节', isHoliday: true },
  '2026-05-03': { name: '劳动节', isHoliday: true },
  '2026-05-04': { name: '劳动节', isHoliday: true },
  '2026-05-05': { name: '劳动节', isHoliday: true },
  '2026-05-09': { name: '劳动节调休', isHoliday: false },
  '2026-06-19': { name: '端午节', isHoliday: true },
  '2026-06-20': { name: '端午节', isHoliday: true },
  '2026-06-21': { name: '端午节', isHoliday: true },
  '2026-09-25': { name: '中秋节', isHoliday: true },
  '2026-09-26': { name: '中秋节', isHoliday: true },
  '2026-09-27': { name: '国庆调休', isHoliday: false },
  '2026-10-01': { name: '国庆节', isHoliday: true },
  '2026-10-02': { name: '国庆节', isHoliday: true },
  '2026-10-03': { name: '国庆节', isHoliday: true },
  '2026-10-04': { name: '国庆节', isHoliday: true },
  '2026-10-05': { name: '国庆节', isHoliday: true },
  '2026-10-06': { name: '国庆节', isHoliday: true },
  '2026-10-07': { name: '国庆节', isHoliday: true },
  '2026-10-10': { name: '国庆调休', isHoliday: false }
};

// -------------------------------------------------------------
// 二十四节气数据库 (2025、2026年精准天文日期)
// -------------------------------------------------------------
const SOLAR_TERMS_DB = {
  '2025-01-05': '小寒', '2025-01-20': '大寒', '2025-02-03': '立春', '2025-02-18': '雨水',
  '2025-03-05': '惊蛰', '2025-03-20': '春分', '2025-04-04': '清明', '2025-04-20': '谷雨',
  '2025-05-05': '立夏', '2025-05-21': '小满', '2025-06-05': '芒种', '2025-06-21': '夏至',
  '2025-07-07': '小暑', '2025-07-22': '大暑', '2025-08-07': '立秋', '2025-08-23': '处暑',
  '2025-09-07': '白露', '2025-09-23': '秋分', '2025-10-08': '寒露', '2025-10-23': '霜降',
  '2025-11-07': '立冬', '2025-11-22': '小雪', '2025-12-07': '大雪', '2025-12-21': '冬至',
  '2026-01-05': '小寒', '2026-01-20': '大寒', '2026-02-04': '立春', '2026-02-18': '雨水',
  '2026-03-05': '惊蛰', '2026-03-20': '春分', '2026-04-05': '清明', '2026-04-20': '谷雨',
  '2026-05-05': '立夏', '2026-05-21': '小满', '2026-06-05': '芒种', '2026-06-21': '夏至',
  '2026-07-07': '小暑', '2026-07-23': '大暑', '2026-08-07': '立秋', '2026-08-23': '处暑',
  '2026-09-07': '白露', '2026-09-23': '秋分', '2026-10-08': '寒露', '2026-10-23': '霜降',
  '2026-11-07': '立冬', '2026-11-22': '小雪', '2026-12-07': '大雪', '2026-12-21': '冬至'
};

const app = Vue.createApp({
  data() {
    const savedShifts = localStorage.getItem('shift_types_v1');
    const savedRotations = localStorage.getItem('shift_rotations_v1');
    const savedSchedules = localStorage.getItem('shift_schedules_v2') || localStorage.getItem('shift_schedules_v1');
    const savedPersons = localStorage.getItem('shift_persons_v1');
    const savedTheme = localStorage.getItem('shift_theme_v1') || 'light';
    const savedViewMode = localStorage.getItem('shift_view_mode_v1') || 'both';
    const savedSnapshots = localStorage.getItem('shift_history_snapshots_v1');

    const savedSyncRoom = localStorage.getItem('shift_sync_room_v1') || '';
    const savedSyncEndpoint = localStorage.getItem('shift_sync_endpoint_v1') || '';
    const savedLastModified = Number(localStorage.getItem('shift_last_modified_v1') || 0);

    const now = new Date();

    let initialSchedules = {};
    if (savedSchedules) {
      try {
        const raw = JSON.parse(savedSchedules);
        Object.keys(raw).forEach(dateStr => {
          const item = raw[dateStr];
          if (item) {
            if (item.p1 !== undefined || item.p2 !== undefined) {
              initialSchedules[dateStr] = {
                p1: item.p1 || null,
                p2: item.p2 || null
              };
            } else if (item.shiftId !== undefined) {
              initialSchedules[dateStr] = {
                p1: { shiftId: item.shiftId, note: item.note || '', hours: item.hours !== undefined ? item.hours : 8 },
                p2: null
              };
            }
          }
        });
      } catch (e) {
        console.error('Failed to parse saved schedules', e);
      }
    }

    return {
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth(),

      shiftTypes: savedShifts ? JSON.parse(savedShifts) : DEFAULT_SHIFTS,
      rotations: savedRotations ? JSON.parse(savedRotations) : DEFAULT_ROTATIONS,
      persons: savedPersons ? JSON.parse(savedPersons) : DEFAULT_PERSONS,
      
      viewMode: savedViewMode,
      schedules: initialSchedules,

      // 历史记录与快照 (用于二次确认清空后回撤恢复)
      historySnapshots: savedSnapshots ? JSON.parse(savedSnapshots) : [],

      theme: savedTheme,
      filterShiftId: '',
      paletteColors: PALETTE_COLORS,
      quickNotes: QUICK_NOTES,

      // 模态框状态
      modals: {
        dayEdit: false,
        shiftManage: false,
        shiftForm: false,
        rotationManage: false,
        rotationForm: false,
        applyRotation: false,
        statsDetail: false,
        exportImport: false,
        personSettings: false,
        cloudSync: false,
        clearConfirm: false,     // 批量/一键清空二次确认弹窗
        historyManage: false,    // 操作历史与撤回管理
        holidayCalendar: false,  // 法定节假日与调休查询日历
        moreSettings: false,     // 底部“我的/更多”设置面板
      },

      SOLAR_TERMS_DB: SOLAR_TERMS_DB,
      currentNavTab: 'calendar', // 'calendar' | 'shift' | 'rotation' | 'stats' | 'more'

      // 批量删除/清空表单
      clearForm: {
        mode: 'all', // 'all' (全量清空) | 'range' (按时间段清空)
        startDate: formatDate(now),
        endDate: formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
        targetPerson: 'both' // 'both' | 'p1' | 'p2'
      },

      // 云端自动同步核心状态
      syncConfig: {
        enabled: Boolean(savedSyncRoom),
        roomId: savedSyncRoom,
        endpoint: savedSyncEndpoint,
        status: savedSyncRoom ? 'syncing' : 'offline',
        lastSyncTime: '',
        lastModified: savedLastModified,
        autoSyncInterval: 5000,
        syncMode: 'auto',
      },
      syncTimer: null,
      sseEventSource: null,
      debouncePushTimer: null,

      activeDateCell: null,
      selectedDateStr: formatDate(now),
      mobileTab: 'calendar', // 'calendar' | 'agenda' | 'stats'
      mobileMoreDrawer: false,
      selectedPersonQuickTab: 'p1', // 'p1' | 'p2'
      activePersonTab: 'p1',
      activeDayForm: {
        dateStr: '',
        p1: { shiftId: '', note: '', hours: 8 },
        p2: { shiftId: '', note: '', hours: 8 }
      },

      personForm: {
        p1Name: '我',
        p1BadgeColor: '#3b82f6',
        p2Name: 'TA',
        p2BadgeColor: '#ec4899'
      },

      shiftFormData: {
        id: '',
        name: '',
        code: '',
        startTime: '08:00',
        endTime: '16:00',
        hours: 8,
        color: '#3b82f6',
        textColor: '#ffffff',
        desc: ''
      },
      isEditingShift: false,

      rotationFormData: {
        id: '',
        name: '',
        desc: '',
        shiftIds: []
      },
      isEditingRotation: false,

      // 开启轮班排班表单 (新功能：法定节假日联动选项)
      applyRotationForm: {
        targetPerson: 'both',
        startDate: formatDate(now),
        p1PlanId: '',
        p1Offset: 0,
        p2PlanId: '',
        p2Offset: 0,
        rangeType: 'months',
        durationValue: 3,
        customEndDate: '',
        overwriteMode: 'all',
        holidayRule: 'statutory_auto', // 'statutory_auto' (遇法定放假设为休息，遇调休设为白班) | 'holiday_rest_only' (仅法定假日设休) | 'none' (常规轮班不调整)
      },

      // 节假日查询年
      holidayQueryYear: 2026,

      statsTab: 'summary',
      toasts: [],
      toastIdCounter: 0,
      jumpYearInput: now.getFullYear(),
      jumpMonthInput: now.getMonth() + 1
    };
  },

  computed: {
    currentMonthTitle() {
      return `${this.currentYear}年 ${this.currentMonth + 1}月`;
    },

    p1Info() {
      return this.persons[0] || DEFAULT_PERSONS[0];
    },

    p2Info() {
      return this.persons[1] || DEFAULT_PERSONS[1];
    },

    shiftMap() {
      const map = {};
      this.shiftTypes.forEach(s => { map[s.id] = s; });
      return map;
    },

    rotationMap() {
      const map = {};
      this.rotations.forEach(r => { map[r.id] = r; });
      return map;
    },

    roomShareUrl() {
      if (!this.syncConfig.roomId) return '';
      const url = new URL(window.location.href);
      url.searchParams.set('room', this.syncConfig.roomId);
      return url.toString();
    },

    // 当前查询年份的所有法定假期与补班清单
    holidayQueryList() {
      const year = String(this.holidayQueryYear);
      const list = [];
      Object.keys(CHINA_HOLIDAYS_DB).forEach(dStr => {
        if (dStr.startsWith(year)) {
          const info = CHINA_HOLIDAYS_DB[dStr];
          list.push({
            dateStr: dStr,
            ...info
          });
        }
      });
      return list.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    },

    currentMonthShiftCounts() {
      const year = this.currentYear;
      const month = this.currentMonth;
      const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      const counts = {};
      this.shiftTypes.forEach(s => {
        counts[s.id] = { id: s.id, name: s.name, color: s.color, count: 0 };
      });

      const targetPersonKey = this.viewMode === 'p2' ? 'p2' : 'p1';
      Object.keys(this.schedules).forEach(dateStr => {
        if (dateStr.startsWith(monthPrefix)) {
          const item = this.schedules[dateStr];
          if (item) {
            const p = item[targetPersonKey];
            if (p && p.shiftId && counts[p.shiftId]) {
              counts[p.shiftId].count++;
            }
          }
        }
      });
      return Object.values(counts);
    },

    calendarDays() {
      const days = [];
      const year = this.currentYear;
      const month = this.currentMonth;

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const totalDays = lastDay.getDate();

      let firstDayWeekday = firstDay.getDay() - 1;
      if (firstDayWeekday === -1) firstDayWeekday = 6;

      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let i = firstDayWeekday - 1; i >= 0; i--) {
        const d = prevMonthLastDay - i;
        const dateObj = new Date(year, month - 1, d);
        const dateStr = formatDate(dateObj);
        days.push(this.buildCellObject(dateObj, dateStr, d, false));
      }

      for (let d = 1; d <= totalDays; d++) {
        const dateObj = new Date(year, month, d);
        const dateStr = formatDate(dateObj);
        days.push(this.buildCellObject(dateObj, dateStr, d, true));
      }

      const remaining = (7 - (days.length % 7)) % 7;
      for (let d = 1; d <= remaining; d++) {
        const dateObj = new Date(year, month + 1, d);
        const dateStr = formatDate(dateObj);
        days.push(this.buildCellObject(dateObj, dateStr, d, false));
      }

      if (days.length <= 35) {
        const currentLength = days.length;
        const extraNeeded = 42 - currentLength;
        const startD = remaining + 1;
        for (let d = startD; d < startD + extraNeeded; d++) {
          const dateObj = new Date(year, month + 1, d);
          const dateStr = formatDate(dateObj);
          days.push(this.buildCellObject(dateObj, dateStr, d, false));
        }
      }

      return days;
    },

    monthlyStats() {
      const year = this.currentYear;
      const month = this.currentMonth;
      const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

      const p1Stats = this.calculatePersonStats('p1', monthPrefix);
      const p2Stats = this.calculatePersonStats('p2', monthPrefix);

      const mutualRestList = [];
      const sameShiftList = [];

      for (let d = 1; d <= totalDaysInMonth; d++) {
        const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
        const item = this.schedules[dateStr];
        if (item) {
          const p1 = item.p1;
          const p2 = item.p2;

          const p1Shift = p1 && p1.shiftId ? this.shiftMap[p1.shiftId] : null;
          const p2Shift = p2 && p2.shiftId ? this.shiftMap[p2.shiftId] : null;

          const p1IsRest = this.isRest(p1Shift);
          const p2IsRest = this.isRest(p2Shift);

          if (p1Shift && p2Shift && p1IsRest && p2IsRest) {
            const dateObj = new Date(year, month, d);
            mutualRestList.push({
              dateStr,
              dayNumber: d,
              weekday: ['周日','周一','周二','周三','周四','周五','周六'][dateObj.getDay()],
              isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6
            });
          }

          if (p1Shift && p2Shift && !p1IsRest && !p2IsRest && p1Shift.id === p2Shift.id) {
            sameShiftList.push({
              dateStr,
              shift: p1Shift
            });
          }
        }
      }

      return {
        mutualRestList,
        mutualRestCount: mutualRestList.length,
        sameShiftCount: sameShiftList.length,
        p1: p1Stats,
        p2: p2Stats
      };
    },

    applyRotationPreview() {
      const form = this.applyRotationForm;
      const start = new Date(form.startDate);
      if (isNaN(start.getTime())) return [];

      const p1Plan = this.rotationMap[form.p1PlanId];
      const p2Plan = this.rotationMap[form.p2PlanId];

      const previewList = [];
      const p1Offset = Number(form.p1Offset) || 0;
      const p2Offset = Number(form.p2Offset) || 0;

      for (let i = 0; i < 14; i++) {
        const curDate = new Date(start);
        curDate.setDate(start.getDate() + i);
        const dateStr = formatDate(curDate);
        const holInfo = this.getChinaHolidayInfo(dateStr);

        let p1Shift = null;
        let p2Shift = null;

        // 联动法定节假日规则预览
        if (form.holidayRule === 'statutory_auto' && holInfo) {
          if (holInfo.isHoliday) {
            const restShift = this.shiftTypes.find(s => this.isRest(s)) || { name: '休', color: '#10b981', code: '休' };
            p1Shift = restShift;
            p2Shift = restShift;
          } else {
            const workShift = this.shiftTypes.find(s => s.hours >= 8) || { name: '白班', color: '#06b6d4', code: '白' };
            p1Shift = workShift;
            p2Shift = workShift;
          }
        } else {
          if (p1Plan && p1Plan.shiftIds.length > 0) {
            const sId = p1Plan.shiftIds[(i + p1Offset) % p1Plan.shiftIds.length];
            p1Shift = this.shiftMap[sId];
          }
          if (p2Plan && p2Plan.shiftIds.length > 0) {
            const sId = p2Plan.shiftIds[(i + p2Offset) % p2Plan.shiftIds.length];
            p2Shift = this.shiftMap[sId];
          }
        }

        const isMutualRest = Boolean(p1Shift && p2Shift && this.isRest(p1Shift) && this.isRest(p2Shift));

        previewList.push({
          dateStr,
          dayOfWeek: ['日','一','二','三','四','五','六'][curDate.getDay()],
          p1Shift: p1Shift || { name: '无', color: '#94a3b8', code: '-' },
          p2Shift: p2Shift || { name: '无', color: '#94a3b8', code: '-' },
          isMutualRest,
          holInfo
        });
      }
      return previewList;
    },

    // 选中日期的完整详情对象 (供移动端速览卡片使用)
    selectedDayDetail() {
      const targetStr = this.selectedDateStr || formatDate(new Date());
      const cell = this.calendarDays.find(c => c.dateStr === targetStr);
      if (cell) return cell;

      const [y, m, d] = targetStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return this.buildCellObject(dateObj, targetStr, d, m - 1 === this.currentMonth);
    },

    // 移动端专用日程流清单列表
    agendaDays() {
      const year = this.currentYear;
      const month = this.currentMonth;
      const totalDays = new Date(year, month + 1, 0).getDate();
      const list = [];
      const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

      for (let d = 1; d <= totalDays; d++) {
        const dateObj = new Date(year, month, d);
        const dateStr = formatDate(dateObj);
        const cell = this.buildCellObject(dateObj, dateStr, d, true);
        const weekday = weekNames[dateObj.getDay()];

        // 班次筛选过滤
        if (this.filterShiftId) {
          const p1Match = cell.p1.shift && cell.p1.shift.id === this.filterShiftId;
          const p2Match = cell.p2.shift && cell.p2.shift.id === this.filterShiftId;
          if (!p1Match && !p2Match) continue;
        }

        list.push({
          ...cell,
          weekday
        });
      }
      return list;
    }
  },

  mounted() {
    this.applyTheme();
    this.checkUrlForRoomParam();

    if (Object.keys(this.schedules).length === 0) {
      this.generateDemoSchedules();
    }

    if (this.rotations.length > 0) {
      this.applyRotationForm.p1PlanId = this.rotations[0].id;
      this.applyRotationForm.p2PlanId = this.rotations.length > 1 ? this.rotations[1].id : this.rotations[0].id;
    }
    this.initPersonForm();
    this.initCloudSync();
  },

  beforeUnmount() {
    this.cleanupCloudSync();
  },

  methods: {
    // =========================================================
    // 🇨🇳 中国法定节假日与调休补班查询
    // =========================================================
    getChinaHolidayInfo(dateStr) {
      return CHINA_HOLIDAYS_DB[dateStr] || null;
    },

    getLunarDayText(cell) {
      if (!cell || !cell.dateStr) return '';
      // 1. 优先展示24节气（如白露、秋分、立秋）
      if (SOLAR_TERMS_DB[cell.dateStr]) {
        return SOLAR_TERMS_DB[cell.dateStr];
      }
      // 2. 传统重大节庆（如中秋、国庆、除夕、春节）
      if (cell.holInfo && cell.holInfo.name) {
        const cleanName = cell.holInfo.name.replace(/调休|假期|节/g, '');
        if (['中秋', '除夕', '春节', '端午', '重阳', '元旦', '国庆'].includes(cleanName)) {
          return cleanName;
        }
      }
      // 3. 农历日期精准算法 (廿一、初一、八月等)
      try {
        const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'numeric', day: 'numeric' }).formatToParts(cell.dateObj);
        const m = parseInt(parts.find(p => p.type === 'month')?.value, 10);
        const d = parseInt(parts.find(p => p.type === 'day')?.value, 10);
        const LUNAR_DAYS = ['', '初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
          '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
          '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
        const LUNAR_MONTHS = ['', '正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','腊月'];
        if (d === 1) return LUNAR_MONTHS[m] || '初一';
        return LUNAR_DAYS[d] || `${d}`;
      } catch (e) {
        return '';
      }
    },

    switchNavTab(tab) {
      this.currentNavTab = tab;
      this._modalOpenTime = Date.now();
      // 复位所有弹窗，确保同一时刻仅呈现唯一的最新交互层
      Object.keys(this.modals).forEach(k => {
        this.modals[k] = false;
      });
      this.mobileMoreDrawer = false;

      if (tab === 'calendar') {
        // 聚焦主月历
      } else if (tab === 'shift') {
        this.modals.shiftManage = true;
      } else if (tab === 'rotation') {
        this.modals.rotationManage = true;
      } else if (tab === 'stats') {
        this.modals.statsDetail = true;
      } else if (tab === 'more') {
        this.modals.moreSettings = true;
      }
    },

    openSubModal(modalName) {
      // 1. 先关闭当前菜单抽屉，记录切换时间戳
      this._modalOpenTime = Date.now();
      this.modals.moreSettings = false;
      this.mobileMoreDrawer = false;

      // 2. 延迟 90ms 开启目标弹窗，彻底规避移动端合成事件穿透 (Ghost Click) 与动画首帧遮罩误触关闭
      setTimeout(() => {
        if (modalName && this.modals[modalName] !== undefined) {
          Object.keys(this.modals).forEach(k => {
            if (k !== modalName) this.modals[k] = false;
          });
          this.modals[modalName] = true;
          this._modalOpenTime = Date.now();
        }
      }, 90);
    },

    handleOverlayClick(modalName) {
      // 刚打开 280ms 内忽略遮罩点击，杜绝移动端穿透误关
      if (this._modalOpenTime && (Date.now() - this._modalOpenTime < 280)) {
        return;
      }
      if (modalName && this.modals[modalName] !== undefined) {
        this.modals[modalName] = false;
      }
      if (modalName === 'moreSettings') {
        this.mobileMoreDrawer = false;
        this.currentNavTab = 'calendar';
      }
    },

    activePersonShift(cell) {
      if (!cell) return null;
      if (this.viewMode === 'p2') {
        return cell.p2?.shift || null;
      }
      return cell.p1?.shift || null;
    },

    isSolarTerm(cell) {
      if (!cell || !cell.dateStr) return false;
      return Boolean(SOLAR_TERMS_DB && SOLAR_TERMS_DB[cell.dateStr]);
    },

    isTraditionalFestival(cell) {
      if (!cell || !cell.holInfo || !cell.holInfo.name) return false;
      return ['中秋','除夕','春节','端午','重阳','元旦','清明','国庆'].some(f => cell.holInfo.name.includes(f));
    },

    // =========================================================
    // 🛡️ 历史快照与撤回恢复系统 (Undo / Snapshot System)
    // =========================================================
    createHistorySnapshot(title, type = 'user_action', affectedCount = 0) {
      const snapshot = {
        id: 'snap_' + Date.now(),
        title,
        type,
        affectedCount,
        timestamp: Date.now(),
        timeStr: new Date().toLocaleString('zh-CN', { hour12: false }),
        dataBackup: JSON.parse(JSON.stringify(this.schedules))
      };

      this.historySnapshots.unshift(snapshot);
      // 最多保留最近 30 次历史记录
      if (this.historySnapshots.length > 30) {
        this.historySnapshots = this.historySnapshots.slice(0, 30);
      }
      this.saveHistorySnapshots();
    },

    saveHistorySnapshots() {
      localStorage.setItem('shift_history_snapshots_v1', JSON.stringify(this.historySnapshots));
    },

    // 打开二次确认清空弹窗
    promptClearAll() {
      this.clearForm.mode = 'all';
      this.modals.clearConfirm = true;
    },

    promptClearRange() {
      this.clearForm.mode = 'range';
      this.modals.clearConfirm = true;
    },

    // 执行一键清空全部或范围清空
    executeClearConfirm() {
      const countBefore = Object.keys(this.schedules).length;

      if (this.clearForm.mode === 'all') {
        if (countBefore === 0) {
          this.showToast('当前排班表已为空', 'info');
          this.modals.clearConfirm = false;
          return;
        }

        // 1. 自动生成历史快照，供随时一键撤回
        this.createHistorySnapshot(`一键清空全量排班`, 'clear_all', countBefore);

        // 2. 清空全部排班
        this.schedules = {};
        this.saveSchedulesToStorage();
        this.modals.clearConfirm = false;
        this.showToast(`已成功清空所有排班！已自动归档快照，可随时在「历史记录」中一键撤回`, 'success');
      } else {
        // 范围清空
        const start = new Date(this.clearForm.startDate);
        const end = new Date(this.clearForm.endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
          this.showToast('请选择正确的清空起止日期', 'warning');
          return;
        }

        this.createHistorySnapshot(`批量清空 ${this.clearForm.startDate} ~ ${this.clearForm.endDate} 排班`, 'clear_range', 0);

        let cleared = 0;
        const cur = new Date(start);
        const target = this.clearForm.targetPerson;

        while (cur <= end) {
          const dStr = formatDate(cur);
          if (this.schedules[dStr]) {
            if (target === 'both') {
              delete this.schedules[dStr];
            } else if (target === 'p1') {
              this.schedules[dStr].p1 = null;
              if (!this.schedules[dStr].p2) delete this.schedules[dStr];
            } else if (target === 'p2') {
              this.schedules[dStr].p2 = null;
              if (!this.schedules[dStr].p1) delete this.schedules[dStr];
            }
            cleared++;
          }
          cur.setDate(cur.getDate() + 1);
        }

        this.saveSchedulesToStorage();
        this.modals.clearConfirm = false;
        this.showToast(`已清空所选时间范围 (${cleared} 天) 的排班记录，可随时在历史记录中撤回`, 'success');
      }
    },

    // 撤回 / 恢复到某个历史快照
    rollbackSnapshot(snapshot) {
      if (!confirm(`确定要撤回恢复到【${snapshot.title} (${snapshot.timeStr})】版本吗？\n当前的数据将被恢复至该时间点的状态。`)) return;

      // 恢复前先将当前状态作为自动备份保存一次，避免后悔
      this.createHistorySnapshot(`撤回恢复前自动备份`, 'auto_backup', Object.keys(this.schedules).length);

      this.schedules = JSON.parse(JSON.stringify(snapshot.dataBackup || {}));
      this.saveSchedulesToStorage();
      this.modals.historyManage = false;
      this.showToast(`已成功撤回恢复到版本：${snapshot.timeStr}`, 'success');
    },

    // 删除单条历史记录
    deleteSnapshot(id) {
      this.historySnapshots = this.historySnapshots.filter(s => s.id !== id);
      this.saveHistorySnapshots();
      this.showToast('该条历史记录已删除', 'info');
    },

    // 清空全部历史归档
    clearAllSnapshots() {
      if (!confirm('确定要清空所有的历史归档记录吗？该操作不可撤销。')) return;
      this.historySnapshots = [];
      this.saveHistorySnapshots();
      this.showToast('所有历史记录已清除', 'info');
    },

    // =========================================================
    // ☁️ 云端自动同步引擎
    // =========================================================
    checkUrlForRoomParam() {
      try {
        const url = new URL(window.location.href);
        const roomParam = url.searchParams.get('room');
        if (roomParam && roomParam.trim()) {
          const newRoom = roomParam.trim();
          if (newRoom !== this.syncConfig.roomId) {
            this.syncConfig.roomId = newRoom;
            this.syncConfig.enabled = true;
            localStorage.setItem('shift_sync_room_v1', newRoom);
            this.showToast(`已通过链接加入同步房间：${newRoom}`, 'success');
          }
        }
      } catch (e) {
        console.error('URL parse error', e);
      }
    },

    getSyncApiUrl() {
      const roomId = encodeURIComponent(this.syncConfig.roomId.trim());
      if (this.syncConfig.endpoint && this.syncConfig.endpoint.trim()) {
        const base = this.syncConfig.endpoint.trim().replace(/\/$/, '');
        return `${base}/${roomId}`;
      }

      if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        return `/api/sync/${roomId}`;
      }

      return `http://localhost:3000/api/sync/${roomId}`;
    },

    getSyncEventsUrl() {
      const apiUrl = this.getSyncApiUrl();
      return `${apiUrl}/events`;
    },

    initCloudSync() {
      if (!this.syncConfig.roomId) {
        this.syncConfig.status = 'offline';
        return;
      }

      this.pullFromCloud(true);
      this.setupSSEConnection();

      if (!this.syncTimer) {
        this.syncTimer = setInterval(() => {
          if (this.syncConfig.roomId && !document.hidden) {
            this.pullFromCloud(true);
          }
        }, 5000);
      }

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.syncConfig.roomId) {
          this.pullFromCloud(true);
        }
      });
      window.addEventListener('focus', () => {
        if (this.syncConfig.roomId) {
          this.pullFromCloud(true);
        }
      });
    },

    setupSSEConnection() {
      if (typeof EventSource === 'undefined' || !this.syncConfig.roomId) return;

      if (this.sseEventSource) {
        try { this.sseEventSource.close(); } catch (e) {}
      }

      try {
        const sseUrl = this.getSyncEventsUrl();
        this.sseEventSource = new EventSource(sseUrl);

        this.sseEventSource.addEventListener('update', (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload && payload.lastModified && payload.lastModified > this.syncConfig.lastModified) {
              this.applyIncomingCloudData(payload.data, payload.lastModified);
              this.showToast('对方已更新排班，已实时同步！', 'info');
            }
          } catch (e) {
            console.error('SSE parse error', e);
          }
        });

        this.sseEventSource.onopen = () => {
          this.syncConfig.status = 'connected';
        };

        this.sseEventSource.onerror = () => {
          this.syncConfig.status = 'connected';
        };
      } catch (err) {
        console.log('SSE not available on this origin, fallback to polling');
      }
    },

    cleanupCloudSync() {
      if (this.syncTimer) {
        clearInterval(this.syncTimer);
        this.syncTimer = null;
      }
      if (this.sseEventSource) {
        try { this.sseEventSource.close(); } catch (e) {}
        this.sseEventSource = null;
      }
    },

    async pullFromCloud(silent = false) {
      if (!this.syncConfig.roomId) return;

      const url = this.getSyncApiUrl();
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'no-store'
        });

        if (!res.ok) throw new Error(`HTTP error ${res.status}`);

        const resData = await res.json();
        if (resData.exists && resData.data) {
          if (resData.lastModified > this.syncConfig.lastModified) {
            this.applyIncomingCloudData(resData.data, resData.lastModified);
            if (!silent) {
              this.showToast('云端最新排班已同步成功！', 'success');
            }
          }
        }
        this.syncConfig.status = 'connected';
        this.syncConfig.lastSyncTime = new Date().toLocaleTimeString();
      } catch (err) {
        if (!silent) {
          this.showToast('连接云端同步服务失败，请检查网络或房间设置', 'warning');
        }
      }
    },

    applyIncomingCloudData(data, lastModified) {
      if (!data) return;

      if (data.persons) {
        this.persons = data.persons;
        localStorage.setItem('shift_persons_v1', JSON.stringify(this.persons));
        this.initPersonForm();
      }
      if (data.shiftTypes) {
        this.shiftTypes = data.shiftTypes;
        localStorage.setItem('shift_types_v1', JSON.stringify(this.shiftTypes));
      }
      if (data.rotations) {
        this.rotations = data.rotations;
        localStorage.setItem('shift_rotations_v1', JSON.stringify(this.rotations));
      }
      if (data.schedules) {
        this.schedules = data.schedules;
        localStorage.setItem('shift_schedules_v2', JSON.stringify(this.schedules));
      }

      this.syncConfig.lastModified = lastModified || Date.now();
      localStorage.setItem('shift_last_modified_v1', String(this.syncConfig.lastModified));
      this.syncConfig.lastSyncTime = new Date().toLocaleTimeString();
    },

    triggerCloudPush() {
      if (!this.syncConfig.roomId) return;

      clearTimeout(this.debouncePushTimer);
      this.syncConfig.status = 'syncing';

      this.debouncePushTimer = setTimeout(() => {
        this.pushToCloud();
      }, 400);
    },

    async pushToCloud() {
      if (!this.syncConfig.roomId) return;

      const url = this.getSyncApiUrl();
      const payload = {
        persons: this.persons,
        shiftTypes: this.shiftTypes,
        rotations: this.rotations,
        schedules: this.schedules,
        lastModified: Date.now()
      };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: payload })
        });

        if (!res.ok) throw new Error(`HTTP error ${res.status}`);

        const result = await res.json();
        this.syncConfig.lastModified = result.lastModified || payload.lastModified;
        localStorage.setItem('shift_last_modified_v1', String(this.syncConfig.lastModified));
        this.syncConfig.status = 'connected';
        this.syncConfig.lastSyncTime = new Date().toLocaleTimeString();
      } catch (err) {
        this.syncConfig.status = 'error';
        console.error('Push to cloud failed', err);
      }
    },

    generateRandomRoomId() {
      const prefix = ['LOVE', 'HOME', 'SHIFT', 'TEAM', 'PAIR'][Math.floor(Math.random() * 5)];
      const num = Math.floor(1000 + Math.random() * 9000);
      this.syncConfig.roomId = `${prefix}-${num}`;
    },

    saveSyncConfig() {
      const room = this.syncConfig.roomId.trim();
      if (!room) {
        this.showToast('请输入或生成一个房间号', 'warning');
        return;
      }

      localStorage.setItem('shift_sync_room_v1', room);
      localStorage.setItem('shift_sync_endpoint_v1', (this.syncConfig.endpoint || '').trim());
      this.syncConfig.enabled = true;
      this.modals.cloudSync = false;

      this.cleanupCloudSync();
      this.initCloudSync();
      this.pushToCloud();
      this.showToast(`已开启云端实时同步！房间：${room}`, 'success');
    },

    leaveSyncRoom() {
      if (!confirm('确定要退出当前同步房间吗？本地已有的排班数据依然会保留。')) return;

      this.cleanupCloudSync();
      this.syncConfig.roomId = '';
      this.syncConfig.enabled = false;
      this.syncConfig.status = 'offline';
      localStorage.removeItem('shift_sync_room_v1');
      this.modals.cloudSync = false;
      this.showToast('已断开云端同步', 'info');
    },

    copyShareLink() {
      if (!this.syncConfig.roomId) {
        this.showToast('请先设置房间号', 'warning');
        return;
      }

      const shareUrl = this.roomShareUrl;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          this.showToast('专属同步链接已复制！发送给对方直接打开即可实时互相同步！', 'success');
        }).catch(() => {
          this.fallbackCopyText(shareUrl);
        });
      } else {
        this.fallbackCopyText(shareUrl);
      }
    },

    fallbackCopyText(text) {
      const input = document.createElement('textarea');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      this.showToast('专属同步链接已复制！', 'success');
    },

    // =========================================================
    // 基础排班与单日交互业务
    // =========================================================
    isRest(shift) {
      if (!shift) return false;
      return shift.hours === 0 || shift.name.includes('休') || shift.code === '休' || shift.id === 'shift_rest';
    },

    buildCellObject(dateObj, dateStr, dayNumber, isCurrentMonth) {
      const todayStr = formatDate(new Date());
      const isToday = dateStr === todayStr;
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const scheduleItem = this.schedules[dateStr] || {};
      const p1 = scheduleItem.p1 || null;
      const p2 = scheduleItem.p2 || null;

      const p1Shift = p1 && p1.shiftId ? this.shiftMap[p1.shiftId] : null;
      const p2Shift = p2 && p2.shiftId ? this.shiftMap[p2.shiftId] : null;

      const p1IsRest = this.isRest(p1Shift);
      const p2IsRest = this.isRest(p2Shift);

      const isMutualRest = Boolean(p1Shift && p2Shift && p1IsRest && p2IsRest);
      const isSameShift = Boolean(p1Shift && p2Shift && !p1IsRest && !p2IsRest && p1Shift.id === p2Shift.id);

      // 法定节假日与调休补班识别
      const holInfo = this.getChinaHolidayInfo(dateStr);

      return {
        dateObj,
        dateStr,
        dayNumber,
        isCurrentMonth,
        isToday,
        isWeekend,
        scheduleItem,
        p1: { data: p1, shift: p1Shift, isRest: p1IsRest },
        p2: { data: p2, shift: p2Shift, isRest: p2IsRest },
        isMutualRest,
        isSameShift,
        holInfo
      };
    },

    calculatePersonStats(personKey, monthPrefix) {
      const stats = {};
      this.shiftTypes.forEach(shift => {
        stats[shift.id] = { shift, count: 0, totalHours: 0 };
      });

      let totalScheduledDays = 0;
      let totalWorkHours = 0;
      let noteCount = 0;

      Object.keys(this.schedules).forEach(dateStr => {
        if (dateStr.startsWith(monthPrefix)) {
          const entry = this.schedules[dateStr];
          const p = entry ? entry[personKey] : null;
          if (p && p.shiftId && stats[p.shiftId]) {
            stats[p.shiftId].count += 1;
            const hours = p.hours !== undefined ? p.hours : stats[p.shiftId].shift.hours;
            stats[p.shiftId].totalHours += Number(hours || 0);
            totalScheduledDays += 1;
            totalWorkHours += Number(hours || 0);
          }
          if (p && p.note && p.note.trim()) {
            noteCount += 1;
          }
        }
      });

      const list = Object.values(stats).map(item => {
        const percentage = totalScheduledDays > 0 ? Math.round((item.count / totalScheduledDays) * 100) : 0;
        return { ...item, percentage };
      });

      const restShift = this.shiftTypes.find(s => this.isRest(s));
      const restDays = restShift && stats[restShift.id] ? stats[restShift.id].count : 0;
      const workDays = Math.max(0, totalScheduledDays - restDays);

      return {
        list,
        totalScheduledDays,
        totalWorkHours,
        workDays,
        restDays,
        noteCount
      };
    },

    setViewMode(mode) {
      this.viewMode = mode;
      localStorage.setItem('shift_view_mode_v1', mode);
      const name = mode === 'both' ? '双人对比视图' : (mode === 'p1' ? `仅看【${this.p1Info.name}】` : `仅看【${this.p2Info.name}】`);
      this.showToast(`已切换至：${name}`, 'info');
    },

    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('shift_theme_v1', this.theme);
      this.applyTheme();
    },
    applyTheme() {
      document.documentElement.setAttribute('data-theme', this.theme);
      if (this.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    },

    prevMonth() {
      if (this.currentMonth === 0) {
        this.currentMonth = 11;
        this.currentYear -= 1;
      } else {
        this.currentMonth -= 1;
      }
      this.updateSelectedDateForMonth();
      this.syncJumpInputs();
    },
    nextMonth() {
      if (this.currentMonth === 11) {
        this.currentMonth = 0;
        this.currentYear += 1;
      } else {
        this.currentMonth += 1;
      }
      this.updateSelectedDateForMonth();
      this.syncJumpInputs();
    },
    goToToday() {
      const now = new Date();
      this.currentYear = now.getFullYear();
      this.currentMonth = now.getMonth();
      this.selectedDateStr = formatDate(now);
      this.syncJumpInputs();
      this.showToast('已回到今天', 'info');
    },
    applyJump() {
      const y = parseInt(this.jumpYearInput);
      const m = parseInt(this.jumpMonthInput);
      if (y >= 1970 && y <= 2100 && m >= 1 && m <= 12) {
        this.currentYear = y;
        this.currentMonth = m - 1;
        this.updateSelectedDateForMonth();
        this.showToast(`已跳转至 ${y}年${m}月`, 'success');
      }
    },
    updateSelectedDateForMonth() {
      const now = new Date();
      if (now.getFullYear() === this.currentYear && now.getMonth() === this.currentMonth) {
        this.selectedDateStr = formatDate(now);
      } else {
        this.selectedDateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-01`;
      }
    },
    syncJumpInputs() {
      this.jumpYearInput = this.currentYear;
      this.jumpMonthInput = this.currentMonth + 1;
    },

    handleCellClick(cell) {
      this.selectedDateStr = cell.dateStr;
      this.activeDateCell = cell;
      const sched = cell.scheduleItem || {};
      const p1 = sched.p1 || {};
      const p2 = sched.p2 || {};

      this.activeDayForm = {
        dateStr: cell.dateStr,
        p1: {
          shiftId: p1.shiftId || '',
          note: p1.note || '',
          hours: p1.hours !== undefined ? p1.hours : (p1.shiftId && this.shiftMap[p1.shiftId] ? this.shiftMap[p1.shiftId].hours : 8)
        },
        p2: {
          shiftId: p2.shiftId || '',
          note: p2.note || '',
          hours: p2.hours !== undefined ? p2.hours : (p2.shiftId && this.shiftMap[p2.shiftId] ? this.shiftMap[p2.shiftId].hours : 8)
        }
      };

      // 单日点击立即弹出排班编辑弹窗 (手机端与桌面端统一顺畅交互)
      this.modals.dayEdit = true;
    },

    openDayEditForSelected() {
      const cell = this.selectedDayDetail;
      this.activeDateCell = cell;
      const sched = this.schedules[this.selectedDateStr] || {};
      const p1 = sched.p1 || {};
      const p2 = sched.p2 || {};

      this.activeDayForm = {
        dateStr: this.selectedDateStr,
        p1: {
          shiftId: p1.shiftId || '',
          note: p1.note || '',
          hours: p1.hours !== undefined ? p1.hours : (p1.shiftId && this.shiftMap[p1.shiftId] ? this.shiftMap[p1.shiftId].hours : 8)
        },
        p2: {
          shiftId: p2.shiftId || '',
          note: p2.note || '',
          hours: p2.hours !== undefined ? p2.hours : (p2.shiftId && this.shiftMap[p2.shiftId] ? this.shiftMap[p2.shiftId].hours : 8)
        }
      };
      this.modals.dayEdit = true;
    },

    quickAssignShift(personKey, shiftId) {
      const dateStr = this.selectedDateStr;
      if (!dateStr) return;

      const current = this.schedules[dateStr] || { p1: null, p2: null };
      const shift = this.shiftMap[shiftId];
      const existingPersonData = current[personKey] || {};

      // 若点击已选中的班次，再次点击可切换为清除；若不同班次则覆盖
      const nextShiftId = existingPersonData.shiftId === shiftId ? '' : shiftId;
      const nextHours = nextShiftId && shift ? shift.hours : 0;

      const updatedPerson = nextShiftId ? {
        shiftId: nextShiftId,
        hours: nextHours,
        note: existingPersonData.note || ''
      } : (existingPersonData.note ? { shiftId: '', hours: 0, note: existingPersonData.note } : null);

      const nextEntry = {
        ...current,
        [personKey]: updatedPerson
      };

      if (!nextEntry.p1 && !nextEntry.p2) {
        delete this.schedules[dateStr];
      } else {
        this.schedules[dateStr] = nextEntry;
      }

      this.saveSchedulesToStorage();
      const personName = personKey === 'p1' ? this.p1Info.name : this.p2Info.name;
      const shiftName = nextShiftId && shift ? shift.name : '已清除';
      this.showToast(`${personName}：${shiftName}`, 'success');
    },

    quickClearDay(dateStr) {
      if (!this.schedules[dateStr]) return;
      delete this.schedules[dateStr];
      this.saveSchedulesToStorage();
      this.showToast('已清空该日排班', 'info');
    },

    selectDayShift(personKey, shiftId) {
      this.activeDayForm[personKey].shiftId = shiftId;
      const shift = this.shiftMap[shiftId];
      if (shift) {
        this.activeDayForm[personKey].hours = shift.hours;
      }
    },

    clearDayShift(personKey) {
      this.activeDayForm[personKey].shiftId = '';
      this.activeDayForm[personKey].hours = 0;
    },

    insertQuickNote(personKey, text) {
      const cur = this.activeDayForm[personKey].note;
      if (cur) {
        this.activeDayForm[personKey].note += '；' + text;
      } else {
        this.activeDayForm[personKey].note = text;
      }
    },

    saveDayEdit() {
      const dateStr = this.activeDayForm.dateStr;
      const p1 = this.activeDayForm.p1;
      const p2 = this.activeDayForm.p2;

      const p1Valid = Boolean(p1.shiftId || (p1.note && p1.note.trim()));
      const p2Valid = Boolean(p2.shiftId || (p2.note && p2.note.trim()));

      if (!p1Valid && !p2Valid) {
        delete this.schedules[dateStr];
      } else {
        this.schedules[dateStr] = {
          p1: p1Valid ? { shiftId: p1.shiftId, note: (p1.note || '').trim(), hours: Number(p1.hours || 0) } : null,
          p2: p2Valid ? { shiftId: p2.shiftId, note: (p2.note || '').trim(), hours: Number(p2.hours || 0) } : null,
        };
      }

      this.saveSchedulesToStorage();
      this.modals.dayEdit = false;
      this.showToast(`${dateStr} 双人排班已更新并同步`, 'success');
    },

    openRotationFromActiveDay() {
      this.applyRotationForm.startDate = this.activeDayForm.dateStr;
      this.modals.dayEdit = false;
      this.modals.applyRotation = true;
    },

    // 自动轮班排班核心执行逻辑 (包含法定节假日智能判定与备份快照)
    executeApplyRotation() {
      const form = this.applyRotationForm;
      const target = form.targetPerson;

      const p1Plan = this.rotationMap[form.p1PlanId];
      const p2Plan = this.rotationMap[form.p2PlanId];

      if ((target === 'p1' || target === 'both') && (!p1Plan || !p1Plan.shiftIds || p1Plan.shiftIds.length === 0)) {
        this.showToast(`请为【${this.p1Info.name}】选择有效的轮班方案`, 'warning');
        return;
      }
      if ((target === 'p2' || target === 'both') && (!p2Plan || !p2Plan.shiftIds || p2Plan.shiftIds.length === 0)) {
        this.showToast(`请为【${this.p2Info.name}】选择有效的轮班方案`, 'warning');
        return;
      }

      const start = new Date(form.startDate);
      if (isNaN(start.getTime())) {
        this.showToast('请填写正确的起始日期', 'warning');
        return;
      }

      let end = new Date(start);
      if (form.rangeType === 'months') {
        end.setMonth(end.getMonth() + (Number(form.durationValue) || 1));
      } else if (form.rangeType === 'days') {
        end.setDate(end.getDate() + (Number(form.durationValue) || 30));
      } else if (form.rangeType === 'until') {
        if (!form.customEndDate) {
          this.showToast('请指定自定义截止日期', 'warning');
          return;
        }
        end = new Date(form.customEndDate);
      }

      if (end < start) {
        this.showToast('截止日期不能早于起始日期', 'warning');
        return;
      }

      // 执行轮班排班前，自动创建备份快照
      this.createHistorySnapshot(`自动轮班排班生成前备份 (${form.startDate} 起)`, 'apply_rotation', Object.keys(this.schedules).length);

      const p1Offset = Number(form.p1Offset) || 0;
      const p2Offset = Number(form.p2Offset) || 0;

      // 寻找通用休息班次和常白班班次
      const restShiftObj = this.shiftTypes.find(s => this.isRest(s)) || this.shiftTypes[0];
      const workShiftObj = this.shiftTypes.find(s => !this.isRest(s)) || this.shiftTypes[0];

      let countAssigned = 0;
      const cur = new Date(start);
      let dayIndex = 0;

      while (cur <= end) {
        const dateStr = formatDate(cur);
        const existing = this.schedules[dateStr] || { p1: null, p2: null };
        const holInfo = this.getChinaHolidayInfo(dateStr);

        let nextP1 = existing.p1 ? { ...existing.p1 } : null;
        let nextP2 = existing.p2 ? { ...existing.p2 } : null;

        // 计算 P1 班次
        if (target === 'p1' || target === 'both') {
          if (form.overwriteMode === 'all' || !nextP1 || !nextP1.shiftId) {
            let finalShiftId = null;
            let noteExtra = '';

            // 法定假日联动判定
            if (form.holidayRule === 'statutory_auto' && holInfo) {
              if (holInfo.isHoliday) {
                finalShiftId = restShiftObj.id;
                noteExtra = `【${holInfo.name}放假】`;
              } else {
                finalShiftId = workShiftObj.id;
                noteExtra = `【${holInfo.name}调休上班】`;
              }
            } else if (form.holidayRule === 'holiday_rest_only' && holInfo && holInfo.isHoliday) {
              finalShiftId = restShiftObj.id;
              noteExtra = `【${holInfo.name}放假】`;
            } else {
              finalShiftId = p1Plan.shiftIds[(dayIndex + p1Offset) % p1Plan.shiftIds.length];
            }

            const shift = this.shiftMap[finalShiftId];
            nextP1 = {
              shiftId: finalShiftId,
              note: (nextP1 && nextP1.note ? nextP1.note + ' ' : '') + noteExtra,
              hours: shift ? shift.hours : 8
            };
          }
        }

        // 计算 P2 班次
        if (target === 'p2' || target === 'both') {
          if (form.overwriteMode === 'all' || !nextP2 || !nextP2.shiftId) {
            let finalShiftId = null;
            let noteExtra = '';

            if (form.holidayRule === 'statutory_auto' && holInfo) {
              if (holInfo.isHoliday) {
                finalShiftId = restShiftObj.id;
                noteExtra = `【${holInfo.name}放假】`;
              } else {
                finalShiftId = workShiftObj.id;
                noteExtra = `【${holInfo.name}调休上班】`;
              }
            } else if (form.holidayRule === 'holiday_rest_only' && holInfo && holInfo.isHoliday) {
              finalShiftId = restShiftObj.id;
              noteExtra = `【${holInfo.name}放假】`;
            } else {
              finalShiftId = p2Plan.shiftIds[(dayIndex + p2Offset) % p2Plan.shiftIds.length];
            }

            const shift = this.shiftMap[finalShiftId];
            nextP2 = {
              shiftId: finalShiftId,
              note: (nextP2 && nextP2.note ? nextP2.note + ' ' : '') + noteExtra,
              hours: shift ? shift.hours : 8
            };
          }
        }

        this.schedules[dateStr] = { p1: nextP1, p2: nextP2 };
        countAssigned++;
        cur.setDate(cur.getDate() + 1);
        dayIndex++;
      }

      this.saveSchedulesToStorage();
      this.modals.applyRotation = false;
      this.showToast(`轮班排班完成！已为 ${countAssigned} 天自动排班并同步`, 'success');

      this.currentYear = start.getFullYear();
      this.currentMonth = start.getMonth();
      this.syncJumpInputs();
    },

    initPersonForm() {
      this.personForm = {
        p1Name: this.p1Info.name,
        p1BadgeColor: this.p1Info.badgeColor || '#3b82f6',
        p2Name: this.p2Info.name,
        p2BadgeColor: this.p2Info.badgeColor || '#ec4899',
      };
    },
    savePersonSettings() {
      if (!this.personForm.p1Name.trim() || !this.personForm.p2Name.trim()) {
        this.showToast('请输入双方称谓/姓名', 'warning');
        return;
      }
      this.persons[0].name = this.personForm.p1Name.trim();
      this.persons[0].badgeColor = this.personForm.p1BadgeColor;
      this.persons[1].name = this.personForm.p2Name.trim();
      this.persons[1].badgeColor = this.personForm.p2BadgeColor;

      localStorage.setItem('shift_persons_v1', JSON.stringify(this.persons));
      this.triggerCloudPush();
      this.modals.personSettings = false;
      this.showToast('双人身份信息已保存并同步', 'success');
    },

    openAddShift() {
      this.isEditingShift = false;
      this.shiftFormData = {
        id: 'shift_' + Date.now(),
        name: '',
        code: '',
        startTime: '08:00',
        endTime: '16:00',
        hours: 8,
        color: '#3b82f6',
        textColor: '#ffffff',
        desc: ''
      };
      this.modals.shiftForm = true;
    },
    openEditShift(shift) {
      this.isEditingShift = true;
      this.shiftFormData = JSON.parse(JSON.stringify(shift));
      this.modals.shiftForm = true;
    },
    saveShiftForm() {
      if (!this.shiftFormData.name.trim()) {
        this.showToast('请输入班次名称', 'warning');
        return;
      }
      if (!this.shiftFormData.code.trim()) {
        this.shiftFormData.code = this.shiftFormData.name.substring(0, 1);
      }
      this.shiftFormData.hours = Number(this.shiftFormData.hours || 0);

      if (this.isEditingShift) {
        const idx = this.shiftTypes.findIndex(s => s.id === this.shiftFormData.id);
        if (idx !== -1) {
          this.shiftTypes[idx] = { ...this.shiftFormData };
        }
        this.showToast('班次信息已更新', 'success');
      } else {
        this.shiftTypes.push({ ...this.shiftFormData });
        this.showToast('新班次创建成功', 'success');
      }

      this.saveShiftsToStorage();
      this.modals.shiftForm = false;
    },
    deleteShift(shiftId) {
      if (this.shiftTypes.length <= 1) {
        this.showToast('至少需要保留一个班次', 'warning');
        return;
      }
      if (!confirm('确定要删除此班次吗？')) return;

      this.shiftTypes = this.shiftTypes.filter(s => s.id !== shiftId);
      this.saveShiftsToStorage();
      this.showToast('班次已删除', 'info');
    },

    openAddRotation() {
      this.isEditingRotation = false;
      this.rotationFormData = {
        id: 'rot_' + Date.now(),
        name: '',
        desc: '',
        shiftIds: this.shiftTypes.length >= 2 
          ? [this.shiftTypes[0].id, this.shiftTypes[1].id] 
          : [this.shiftTypes[0].id]
      };
      this.modals.rotationForm = true;
    },
    openEditRotation(rotation) {
      this.isEditingRotation = true;
      this.rotationFormData = JSON.parse(JSON.stringify(rotation));
      this.modals.rotationForm = true;
    },
    addShiftToRotation(shiftId) {
      this.rotationFormData.shiftIds.push(shiftId);
    },
    removeShiftFromRotation(index) {
      this.rotationFormData.shiftIds.splice(index, 1);
    },
    moveShiftInRotation(index, delta) {
      const targetIndex = index + delta;
      if (targetIndex < 0 || targetIndex >= this.rotationFormData.shiftIds.length) return;
      const item = this.rotationFormData.shiftIds.splice(index, 1)[0];
      this.rotationFormData.shiftIds.splice(targetIndex, 0, item);
    },
    saveRotationForm() {
      if (!this.rotationFormData.name.trim()) {
        this.showToast('请输入轮班方案名称', 'warning');
        return;
      }
      if (this.rotationFormData.shiftIds.length === 0) {
        this.showToast('请至少添加一个班次到轮班序列中', 'warning');
        return;
      }

      if (this.isEditingRotation) {
        const idx = this.rotations.findIndex(r => r.id === this.rotationFormData.id);
        if (idx !== -1) {
          this.rotations[idx] = { ...this.rotationFormData };
        }
        this.showToast('轮班方案已更新', 'success');
      } else {
        this.rotations.push({ ...this.rotationFormData });
        this.showToast('新轮班方案创建成功', 'success');
      }

      this.saveRotationsToStorage();
      this.modals.rotationForm = false;
    },
    deleteRotation(rotId) {
      if (this.rotations.length <= 1) {
        this.showToast('至少保留一个轮班方案', 'warning');
        return;
      }
      if (!confirm('确定删除此轮班方案吗？')) return;

      this.rotations = this.rotations.filter(r => r.id !== rotId);
      this.saveRotationsToStorage();
      this.showToast('轮班方案已删除', 'info');
    },

    saveShiftsToStorage() {
      localStorage.setItem('shift_types_v1', JSON.stringify(this.shiftTypes));
      this.triggerCloudPush();
    },
    saveRotationsToStorage() {
      localStorage.setItem('shift_rotations_v1', JSON.stringify(this.rotations));
      this.triggerCloudPush();
    },
    saveSchedulesToStorage() {
      localStorage.setItem('shift_schedules_v2', JSON.stringify(this.schedules));
      this.triggerCloudPush();
    },

    generateDemoSchedules() {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const plan1 = this.rotations[0];
      const plan2 = this.rotations[1] || this.rotations[0];

      const totalDays = new Date(year, month + 1, 0).getDate();

      for (let d = 1; d <= totalDays; d++) {
        const curDate = new Date(year, month, d);
        const dateStr = formatDate(curDate);

        const sId1 = plan1.shiftIds[(d - 1) % plan1.shiftIds.length];
        const sId2 = plan2.shiftIds[(d + 1) % plan2.shiftIds.length];

        const shift1 = this.shiftMap[sId1];
        const shift2 = this.shiftMap[sId2];

        let note1 = '';
        let note2 = '';
        if (d === 5) note1 = '上午安全例会';
        if (d === 12) note2 = '下午带新人';
        if (d === 20) note1 = '巡检设备保养';

        this.schedules[dateStr] = {
          p1: {
            shiftId: sId1,
            note: note1,
            hours: shift1 ? shift1.hours : 8
          },
          p2: {
            shiftId: sId2,
            note: note2,
            hours: shift2 ? shift2.hours : 8
          }
        };
      }
      this.saveSchedulesToStorage();
    },

    resetToDefaultData() {
      if (!confirm('确定要重置所有排班与设置为默认双人数据吗？')) return;
      localStorage.clear();
      this.shiftTypes = JSON.parse(JSON.stringify(DEFAULT_SHIFTS));
      this.rotations = JSON.parse(JSON.stringify(DEFAULT_ROTATIONS));
      this.persons = JSON.parse(JSON.stringify(DEFAULT_PERSONS));
      this.schedules = {};
      this.historySnapshots = [];
      this.generateDemoSchedules();
      this.saveShiftsToStorage();
      this.saveRotationsToStorage();
      this.initPersonForm();
      this.showToast('已重置为双人默认排班数据', 'success');
      this.modals.exportImport = false;
    },

    exportJSON() {
      const data = {
        version: '2.2',
        exportedAt: new Date().toISOString(),
        persons: this.persons,
        shiftTypes: this.shiftTypes,
        rotations: this.rotations,
        schedules: this.schedules,
        historySnapshots: this.historySnapshots
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      this.downloadBlob(blob, `智巡双人排班备份_${formatDate(new Date())}.json`);
      this.showToast('完整 JSON 备份已下载', 'success');
    },

    importJSON(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (parsed.persons) this.persons = parsed.persons;
          if (parsed.shiftTypes) this.shiftTypes = parsed.shiftTypes;
          if (parsed.rotations) this.rotations = parsed.rotations;
          if (parsed.schedules) this.schedules = parsed.schedules;
          if (parsed.historySnapshots) this.historySnapshots = parsed.historySnapshots;
          this.saveShiftsToStorage();
          this.saveRotationsToStorage();
          this.saveSchedulesToStorage();
          this.saveHistorySnapshots();
          this.initPersonForm();
          this.showToast('双人数据恢复成功！', 'success');
          this.modals.exportImport = false;
        } catch (err) {
          this.showToast('文件格式有误，导入失败', 'error');
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    },

    exportCSV() {
      const p1N = this.p1Info.name;
      const p2N = this.p2Info.name;
      let csvContent = `\uFEFF日期,星期,法定假日/调休,${p1N}班次,${p1N}工时,${p1N}备注,${p2N}班次,${p2N}工时,${p2N}备注,是否共同休息\n`;

      const year = this.currentYear;
      const month = this.currentMonth;
      const totalDays = new Date(year, month + 1, 0).getDate();
      const weekNames = ['周日','周一','周二','周三','周四','周五','周六'];

      for (let d = 1; d <= totalDays; d++) {
        const dateObj = new Date(year, month, d);
        const dateStr = formatDate(dateObj);
        const weekday = weekNames[dateObj.getDay()];
        const sched = this.schedules[dateStr] || {};
        const hol = this.getChinaHolidayInfo(dateStr);
        const holText = hol ? (hol.isHoliday ? `【休】${hol.name}` : `【班】${hol.name}`) : '-';

        const p1 = sched.p1;
        const p2 = sched.p2;

        const s1 = p1 && p1.shiftId ? this.shiftMap[p1.shiftId] : null;
        const s2 = p2 && p2.shiftId ? this.shiftMap[p2.shiftId] : null;

        const isMutualRest = Boolean(s1 && s2 && this.isRest(s1) && this.isRest(s2));

        const p1Name = s1 ? s1.name : '-';
        const p1Hours = p1 ? (p1.hours !== undefined ? p1.hours : (s1 ? s1.hours : 0)) : 0;
        const p1Note = p1 && p1.note ? `"${p1.note.replace(/"/g, '""')}"` : '';

        const p2Name = s2 ? s2.name : '-';
        const p2Hours = p2 ? (p2.hours !== undefined ? p2.hours : (s2 ? s2.hours : 0)) : 0;
        const p2Note = p2 && p2.note ? `"${p2.note.replace(/"/g, '""')}"` : '';

        csvContent += `${dateStr},${weekday},${holText},${p1Name},${p1Hours},${p1Note},${p2Name},${p2Hours},${p2Note},${isMutualRest ? '★共同休息日★' : '否'}\n`;
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      this.downloadBlob(blob, `双人排班对比表_${this.currentYear}年${this.currentMonth + 1}月.csv`);
      this.showToast('双人排班 CSV 表格已导出', 'success');
    },

    exportICS() {
      let ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ShiftMaster//TwoPerson Shift Scheduler//CN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:双人排班日历'
      ];

      const year = this.currentYear;
      const month = this.currentMonth;
      const totalDays = new Date(year, month + 1, 0).getDate();

      const p1N = this.p1Info.name;
      const p2N = this.p2Info.name;

      for (let d = 1; d <= totalDays; d++) {
        const curDate = new Date(year, month, d);
        const dateStr = formatDate(curDate);
        const sched = this.schedules[dateStr];
        if (!sched) continue;

        const s1 = sched.p1 && sched.p1.shiftId ? this.shiftMap[sched.p1.shiftId] : null;
        const s2 = sched.p2 && sched.p2.shiftId ? this.shiftMap[sched.p2.shiftId] : null;

        if (!s1 && !s2) continue;

        const dateCompact = dateStr.replace(/-/g, '');
        const isMutualRest = Boolean(s1 && s2 && this.isRest(s1) && this.isRest(s2));

        let summary = '';
        if (isMutualRest) {
          summary = `🎉【共同休息日】${p1N}休 & ${p2N}休`;
        } else {
          summary = `${p1N}:${s1 ? s1.name : '无'} | ${p2N}:${s2 ? s2.name : '无'}`;
        }

        const descParts = [];
        const hol = this.getChinaHolidayInfo(dateStr);
        if (hol) descParts.push(hol.isHoliday ? `法定节假日: ${hol.name}放假` : `法定节假日: ${hol.name}补班`);
        if (sched.p1 && sched.p1.note) descParts.push(`${p1N}备注: ${sched.p1.note}`);
        if (sched.p2 && sched.p2.note) descParts.push(`${p2N}备注: ${sched.p2.note}`);
        const description = descParts.join('; ') || '智巡排班双人同步';

        ics.push('BEGIN:VEVENT');
        ics.push(`UID:${dateStr}_both_${Date.now()}@shiftmaster.local`);
        ics.push(`DTSTAMP:${dateCompact}T000000Z`);
        ics.push(`DTSTART;VALUE=DATE:${dateCompact}`);
        ics.push(`DTEND;VALUE=DATE:${dateCompact}`);
        ics.push(`SUMMARY:${summary}`);
        ics.push(`DESCRIPTION:${description}`);
        ics.push('STATUS:CONFIRMED');
        ics.push('END:VEVENT');
      }

      ics.push('END:VCALENDAR');
      const blob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8;' });
      this.downloadBlob(blob, `双人排班与共同休息_${this.currentYear}年${this.currentMonth + 1}月.ics`);
      this.showToast('手机日历 ICS 文件已生成（含共同休息日标注）！', 'success');
    },

    printPage() {
      window.print();
    },

    downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    showToast(message, type = 'info') {
      const id = ++this.toastIdCounter;
      this.toasts.push({ id, message, type });
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
      }, 3200);
    }
  }
});

app.mount('#app');
