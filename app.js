/**
 * 智巡排班 (ShiftMaster) - 核心逻辑控制
 * 支持双人协同排班、共同休息日智能识别及云端跨设备实时自动同步
 */

// 预设默认班次定义
const DEFAULT_SHIFTS = [
  { id: 'shift_morning', name: '早班', code: '早', startTime: '08:00', endTime: '16:00', hours: 8, color: '#3b82f6', textColor: '#ffffff', desc: '上午工作班次' },
  { id: 'shift_middle', name: '中班', code: '中', startTime: '16:00', endTime: '24:00', hours: 8, color: '#f59e0b', textColor: '#ffffff', desc: '下午至前半夜班次' },
  { id: 'shift_night', name: '夜班', code: '夜', startTime: '00:00', endTime: '08:00', hours: 8, color: '#8b5cf6', textColor: '#ffffff', desc: '通宵夜班' },
  { id: 'shift_rest', name: '休息', code: '休', startTime: '00:00', endTime: '00:00', hours: 0, color: '#10b981', textColor: '#ffffff', desc: '轮休/调休' },
  { id: 'shift_regular', name: '白班', code: '白', startTime: '09:00', endTime: '18:00', hours: 8, color: '#06b6d4', textColor: '#ffffff', desc: '常日白班' },
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

// 节假日对照
const HOLIDAYS = {
  '01-01': '元旦',
  '02-14': '情人节',
  '03-08': '妇女节',
  '04-05': '清明节',
  '05-01': '劳动节',
  '05-04': '青年节',
  '06-01': '儿童节',
  '07-01': '建党节',
  '08-01': '建军节',
  '09-10': '教师节',
  '10-01': '国庆节',
  '12-25': '圣诞节'
};

const app = Vue.createApp({
  data() {
    // 读取本地存储或初始化
    const savedShifts = localStorage.getItem('shift_types_v1');
    const savedRotations = localStorage.getItem('shift_rotations_v1');
    const savedSchedules = localStorage.getItem('shift_schedules_v2') || localStorage.getItem('shift_schedules_v1');
    const savedPersons = localStorage.getItem('shift_persons_v1');
    const savedTheme = localStorage.getItem('shift_theme_v1') || 'light';
    const savedViewMode = localStorage.getItem('shift_view_mode_v1') || 'both';

    // 云同步本地缓存
    const savedSyncRoom = localStorage.getItem('shift_sync_room_v1') || '';
    const savedSyncEndpoint = localStorage.getItem('shift_sync_endpoint_v1') || '';
    const savedLastModified = Number(localStorage.getItem('shift_last_modified_v1') || 0);

    const now = new Date();

    // 格式化解析排班数据
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
        cloudSync: false, // ☁️ 云端同步设置弹窗
      },

      // 云端自动同步核心状态
      syncConfig: {
        enabled: Boolean(savedSyncRoom),
        roomId: savedSyncRoom,
        endpoint: savedSyncEndpoint,
        status: savedSyncRoom ? 'syncing' : 'offline', // 'connected' | 'syncing' | 'offline' | 'error'
        lastSyncTime: '',
        lastModified: savedLastModified,
        autoSyncInterval: 5000,
        syncMode: 'auto', // 'auto' | 'sse' | 'poll'
      },
      syncTimer: null,
      sseEventSource: null,
      debouncePushTimer: null,

      activeDateCell: null,
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
      },

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

    // 专属双人同步链接 (包含当前域名与房间号，方便一键复制发送给对方)
    roomShareUrl() {
      if (!this.syncConfig.roomId) return '';
      const url = new URL(window.location.href);
      url.searchParams.set('room', this.syncConfig.roomId);
      return url.toString();
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

        let p1Shift = null;
        if (p1Plan && p1Plan.shiftIds.length > 0) {
          const sId = p1Plan.shiftIds[(i + p1Offset) % p1Plan.shiftIds.length];
          p1Shift = this.shiftMap[sId];
        }

        let p2Shift = null;
        if (p2Plan && p2Plan.shiftIds.length > 0) {
          const sId = p2Plan.shiftIds[(i + p2Offset) % p2Plan.shiftIds.length];
          p2Shift = this.shiftMap[sId];
        }

        const isMutualRest = Boolean(p1Shift && p2Shift && this.isRest(p1Shift) && this.isRest(p2Shift));

        previewList.push({
          dateStr,
          dayOfWeek: ['日','一','二','三','四','五','六'][curDate.getDay()],
          p1Shift: p1Shift || { name: '无', color: '#94a3b8', code: '-' },
          p2Shift: p2Shift || { name: '无', color: '#94a3b8', code: '-' },
          isMutualRest
        });
      }
      return previewList;
    }
  },

  mounted() {
    this.applyTheme();

    // 1. 检查 URL 中是否有 ?room=XXXX 传参 (方便通过链接一键自动加入同步房间)
    this.checkUrlForRoomParam();

    // 2. 首次进入若无排班，填充生动贴心的双人排班示例
    if (Object.keys(this.schedules).length === 0) {
      this.generateDemoSchedules();
    }

    if (this.rotations.length > 0) {
      this.applyRotationForm.p1PlanId = this.rotations[0].id;
      this.applyRotationForm.p2PlanId = this.rotations.length > 1 ? this.rotations[1].id : this.rotations[0].id;
    }
    this.initPersonForm();

    // 3. 启动云端同步监听 (自动长连接 / 定时轮询 / 页面唤醒自动刷新)
    this.initCloudSync();
  },

  beforeUnmount() {
    this.cleanupCloudSync();
  },

  methods: {
    // =========================================================
    // ☁️ 云端自动同步引擎 (Cloud Auto-Sync Engine)
    // =========================================================
    
    // 检查 URL 参数是否携带房间号
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

    // 获取实际同步 API URL
    getSyncApiUrl() {
      const roomId = encodeURIComponent(this.syncConfig.roomId.trim());
      if (this.syncConfig.endpoint && this.syncConfig.endpoint.trim()) {
        const base = this.syncConfig.endpoint.trim().replace(/\/$/, '');
        return `${base}/${roomId}`;
      }

      // 如果当前通过 http/https 协议打开，默认探测本站 /api/sync
      if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        return `/api/sync/${roomId}`;
      }

      // 如果是直接双击 index.html (file:///) 运行，默认连向本地启动的 node 服务端口
      return `http://localhost:3000/api/sync/${roomId}`;
    },

    // 获取 SSE 实时长连接 URL
    getSyncEventsUrl() {
      const apiUrl = this.getSyncApiUrl();
      return `${apiUrl}/events`;
    },

    // 初始化云端自动同步机制
    initCloudSync() {
      if (!this.syncConfig.roomId) {
        this.syncConfig.status = 'offline';
        return;
      }

      // 首次拉取最新数据
      this.pullFromCloud(true);

      // 尝试建立 SSE 实时推送通道
      this.setupSSEConnection();

      // 启动心跳/轮询定时器（每 5 秒轮询一次，保证在不支持 SSE 的环境下依然实时同步）
      if (!this.syncTimer) {
        this.syncTimer = setInterval(() => {
          if (this.syncConfig.roomId && !document.hidden) {
            this.pullFromCloud(true);
          }
        }, 5000);
      }

      // 监听浏览器标签页切换/手机熄屏唤醒：一旦回到页面，立即极速刷新同步一次！
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

    // 建立 Server-Sent Events (SSE) 毫秒级长连接
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
          // SSE 失败时自动平滑回退到普通轮询模式，不影响用户使用
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

    // 从云端拉取排班数据
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
          // 比较时间戳，云端数据较新时才覆盖
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
        // 网络异常或本地无服务
        if (!silent) {
          this.showToast('连接云端同步服务失败，请检查网络或房间设置', 'warning');
        }
      }
    },

    // 应用来自云端的最新排班数据
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

    // 防抖触发推送到云端 (在本地发生任意编辑修改时触发)
    triggerCloudPush() {
      if (!this.syncConfig.roomId) return;

      clearTimeout(this.debouncePushTimer);
      this.syncConfig.status = 'syncing';

      this.debouncePushTimer = setTimeout(() => {
        this.pushToCloud();
      }, 400);
    },

    // 真正执行推送到云端
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

    // 生成随机高辨识度房间号 (如：LOVE-8921 或 SHIFT-3420)
    generateRandomRoomId() {
      const prefix = ['LOVE', 'HOME', 'SHIFT', 'TEAM', 'PAIR'][Math.floor(Math.random() * 5)];
      const num = Math.floor(1000 + Math.random() * 9000);
      this.syncConfig.roomId = `${prefix}-${num}`;
    },

    // 保存房间配置
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

      // 重新建立连接并立刻推送本地现有数据到房间中
      this.cleanupCloudSync();
      this.initCloudSync();
      this.pushToCloud();
      this.showToast(`已开启云端实时同步！房间：${room}`, 'success');
    },

    // 退出当前同步房间
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

    // 一键复制双人专属同步链接
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

      const holiday = HOLIDAYS[dateStr.substring(5)] || '';

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
        holiday
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
      this.syncJumpInputs();
    },
    nextMonth() {
      if (this.currentMonth === 11) {
        this.currentMonth = 0;
        this.currentYear += 1;
      } else {
        this.currentMonth += 1;
      }
      this.syncJumpInputs();
    },
    goToToday() {
      const now = new Date();
      this.currentYear = now.getFullYear();
      this.currentMonth = now.getMonth();
      this.syncJumpInputs();
      this.showToast('已回到今天', 'info');
    },
    applyJump() {
      const y = parseInt(this.jumpYearInput);
      const m = parseInt(this.jumpMonthInput);
      if (y >= 1970 && y <= 2100 && m >= 1 && m <= 12) {
        this.currentYear = y;
        this.currentMonth = m - 1;
        this.showToast(`已跳转至 ${y}年${m}月`, 'success');
      }
    },
    syncJumpInputs() {
      this.jumpYearInput = this.currentYear;
      this.jumpMonthInput = this.currentMonth + 1;
    },

    handleCellClick(cell) {
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
      this.modals.dayEdit = true;
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

    // 保存单日修改 (同时本地持久化并自动推送到云端)
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

    // 自动轮班排班核心执行逻辑
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

      const p1Offset = Number(form.p1Offset) || 0;
      const p2Offset = Number(form.p2Offset) || 0;

      let countAssigned = 0;
      const cur = new Date(start);
      let dayIndex = 0;

      while (cur <= end) {
        const dateStr = formatDate(cur);
        const existing = this.schedules[dateStr] || { p1: null, p2: null };

        let nextP1 = existing.p1 ? { ...existing.p1 } : null;
        let nextP2 = existing.p2 ? { ...existing.p2 } : null;

        if (target === 'p1' || target === 'both') {
          if (form.overwriteMode === 'all' || !nextP1 || !nextP1.shiftId) {
            const sId = p1Plan.shiftIds[(dayIndex + p1Offset) % p1Plan.shiftIds.length];
            const shift = this.shiftMap[sId];
            nextP1 = {
              shiftId: sId,
              note: nextP1 && nextP1.note ? nextP1.note : '',
              hours: shift ? shift.hours : 8
            };
          }
        }

        if (target === 'p2' || target === 'both') {
          if (form.overwriteMode === 'all' || !nextP2 || !nextP2.shiftId) {
            const sId = p2Plan.shiftIds[(dayIndex + p2Offset) % p2Plan.shiftIds.length];
            const shift = this.shiftMap[sId];
            nextP2 = {
              shiftId: sId,
              note: nextP2 && nextP2.note ? nextP2.note : '',
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

    clearRotationRange() {
      if (!confirm('确定要清空所选时间范围内的所有排班数据吗？该操作不可撤销。')) return;

      const form = this.applyRotationForm;
      const start = new Date(form.startDate);
      let end = new Date(start);

      if (form.rangeType === 'months') {
        end.setMonth(end.getMonth() + (Number(form.durationValue) || 1));
      } else if (form.rangeType === 'days') {
        end.setDate(end.getDate() + (Number(form.durationValue) || 30));
      } else if (form.rangeType === 'until' && form.customEndDate) {
        end = new Date(form.customEndDate);
      }

      let cleared = 0;
      const cur = new Date(start);
      while (cur <= end) {
        const dateStr = formatDate(cur);
        if (this.schedules[dateStr]) {
          delete this.schedules[dateStr];
          cleared++;
        }
        cur.setDate(cur.getDate() + 1);
      }

      this.saveSchedulesToStorage();
      this.modals.applyRotation = false;
      this.showToast(`已清除 ${cleared} 天的排班记录`, 'info');
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
      this.generateDemoSchedules();
      this.saveShiftsToStorage();
      this.saveRotationsToStorage();
      this.initPersonForm();
      this.showToast('已重置为双人默认排班数据', 'success');
      this.modals.exportImport = false;
    },

    exportJSON() {
      const data = {
        version: '2.1',
        exportedAt: new Date().toISOString(),
        persons: this.persons,
        shiftTypes: this.shiftTypes,
        rotations: this.rotations,
        schedules: this.schedules
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
          this.saveShiftsToStorage();
          this.saveRotationsToStorage();
          this.saveSchedulesToStorage();
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
      let csvContent = `\uFEFF日期,星期,${p1N}班次,${p1N}工时,${p1N}备注,${p2N}班次,${p2N}工时,${p2N}备注,是否共同休息\n`;

      const year = this.currentYear;
      const month = this.currentMonth;
      const totalDays = new Date(year, month + 1, 0).getDate();
      const weekNames = ['周日','周一','周二','周三','周四','周五','周六'];

      for (let d = 1; d <= totalDays; d++) {
        const dateObj = new Date(year, month, d);
        const dateStr = formatDate(dateObj);
        const weekday = weekNames[dateObj.getDay()];
        const sched = this.schedules[dateStr] || {};

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

        csvContent += `${dateStr},${weekday},${p1Name},${p1Hours},${p1Note},${p2Name},${p2Hours},${p2Note},${isMutualRest ? '★共同休息日★' : '否'}\n`;
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
