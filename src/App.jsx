import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Calculator, BarChart3, Save, Trash2, AlertTriangle, 
  CheckCircle, TrendingUp, Activity, Settings, Plus, Briefcase, 
  Edit3, Clock, DollarSign, Cloud, Loader2, LogOut, Lock
} from 'lucide-react';

// --- Firebase SDK 導入 (直接整合) ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, 
  query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged 
} from 'firebase/auth';

// --- Firebase 設定 (直接整合，取代原本的 import) ---
const firebaseConfig = {
  apiKey: "AIzaSyCH8ZyQXxxi1Psd6itOj4C_ksyyagZrdHs",
  authDomain: "microbiz-accounting.firebaseapp.com",
  projectId: "microbiz-accounting",
  storageBucket: "microbiz-accounting.firebasestorage.app",
  messagingSenderId: "258532246326",
  appId: "1:258532246326:web:f1aa5529f522d65526e997",
  measurementId: "G-17ZDJ3JWY8"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- 全域常數 ---
const GLOBAL_CONSTANTS = {
  MEAL_ALLOWANCE: 3000,
};

// --- 預設資料 (用於初次初始化資料庫) ---
const INIT_JOB_ROLES = [
  {
    name: '勞工健康服務護理師 (正職)',
    type: 'fulltime',
    baseSalary: 28590, baseQuota: 5, overQuotaRate: 1200, newCaseBonus: 3000,
    levelAllowances: { 'C': 0, 'B': 3000, 'A': 6000 },
    order: 1
  },
  {
    name: '特約護理師 (兼職)',
    type: 'parttime',
    hourlyRate: 600, hoursPerCase: 2, newCaseBonus: 3000,
    levelAllowances: { 'C': 0, 'B': 0, 'A': 0 },
    order: 2
  }
];

const INIT_KPI_DEFINITIONS = [
  { label: '臨場服務達成率', maxScore: 30, category: 'quantitative', placeholder: '', order: 1 },
  { label: '報告繳交時效', maxScore: 25, category: 'quantitative', placeholder: '遲交每份扣 5 分', order: 2 },
  { label: '教育訓練時數', maxScore: 15, category: 'quantitative', placeholder: '', order: 3 },
  { label: '客戶滿意度', maxScore: 15, category: 'qualitative', placeholder: '', order: 4 },
  { label: '行政配合度', maxScore: 10, category: 'qualitative', placeholder: '', order: 5 },
  { label: '專業形象', maxScore: 5, category: 'qualitative', placeholder: '', order: 6 },
];

// --- 勞健保計算 ---
const calculateInsurance = (totalSalary, employmentType, baseSalary = 0) => {
  const minInsured = employmentType === 'parttime' ? 11100 : Math.max(baseSalary, 27470);
  let insuredSalary = Math.ceil(totalSalary / 1000) * 1000;
  if (insuredSalary < minInsured) insuredSalary = minInsured;
  const laborSalaryCap = Math.min(insuredSalary, 45800); 
  const laborRate = 0.12; 
  const laborEmp = Math.round(laborSalaryCap * laborRate * 0.2);
  const laborComp = Math.round(laborSalaryCap * laborRate * 0.7);
  const healthRate = 0.0517;
  const healthEmp = Math.round(insuredSalary * healthRate * 0.3);
  const healthComp = Math.round(insuredSalary * healthRate * 0.6 * 1.58);
  const pensionSalaryCap = Math.min(insuredSalary, 150000); 
  const pensionComp = Math.round(pensionSalaryCap * 0.06);
  return {
    insuredSalary,
    totalEmpCost: laborEmp + healthEmp,
    totalCompCost: laborComp + healthComp + pensionComp
  };
};

// --- 元件 ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-lg shadow-md border border-gray-200 ${className}`}>
    {children}
  </div>
);

const KPIInput = ({ label, maxScore, value, onChange, placeholder }) => (
  <div className="mb-4">
    <div className="flex justify-between mb-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <span className="text-sm text-gray-500">{value} / {maxScore} 分</span>
    </div>
    <input 
      type="range" min="0" max={maxScore} value={value} 
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
    />
    {placeholder && <p className="text-xs text-gray-400 mt-1">{placeholder}</p>}
  </div>
);

// --- 登入畫面元件 ---
const LoginScreen = ({ onLogin }) => (
  <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
    <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
      <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
        <Lock className="w-8 h-8 text-blue-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">安澤健康顧問</h1>
      <p className="text-gray-500 mb-8">薪資與績效管理系統 (內部專用)</p>
      
      <button 
        onClick={onLogin}
        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors shadow-sm"
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
        使用 Google 帳號登入
      </button>
      <p className="text-xs text-gray-400 mt-6">系統已啟用資安防護，僅限授權人員存取</p>
    </div>
  </div>
);

export default function PayrollApp() {
  const [user, setUser] = useState(null); // 使用者狀態
  const [authLoading, setAuthLoading] = useState(true); // 驗證讀取中
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dataLoading, setDataLoading] = useState(true); // 資料讀取中
  
  // --- Firebase Data States ---
  const [jobRoles, setJobRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [kpiDefinitions, setKpiDefinitions] = useState([]);

  // --- Current Editing State ---
  const [currentSlip, setCurrentSlip] = useState({
    empId: '',
    month: new Date().toISOString().slice(0, 7), 
    cases: '', newCases: '', penaltyPoints: '', kpi: {} 
  });
  const [editingRole, setEditingRole] = useState(null);

  // --- Style Fix ---
  useEffect(() => {
    if (!document.querySelector('script[src^="https://cdn.tailwindcss.com"]')) {
      const script = document.createElement('script');
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
  }, []);

  // --- Auth Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Data Listeners (Only when user is logged in) ---
  useEffect(() => {
    if (!user) return; // 未登入不讀取資料

    const unsubRoles = onSnapshot(query(collection(db, 'job_roles'), orderBy('order', 'asc')), (snapshot) => {
      if (snapshot.empty && !dataLoading) { 
        INIT_JOB_ROLES.forEach(async (role) => await addDoc(collection(db, 'job_roles'), role));
      } else {
        setJobRoles(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    });

    const unsubEmps = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubRecords = onSnapshot(query(collection(db, 'records'), orderBy('createdAt', 'desc')), (snapshot) => {
      setRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubKPIs = onSnapshot(query(collection(db, 'kpi_definitions'), orderBy('order', 'asc')), (snapshot) => {
      if (snapshot.empty && !dataLoading) {
        INIT_KPI_DEFINITIONS.forEach(async (kpi) => await addDoc(collection(db, 'kpi_definitions'), kpi));
      } else {
        setKpiDefinitions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    });

    setDataLoading(false);
    return () => { unsubRoles(); unsubEmps(); unsubRecords(); unsubKPIs(); };
  }, [user]);

  useEffect(() => {
    if (kpiDefinitions.length > 0) {
      setCurrentSlip(prev => {
        const newKpi = { ...prev.kpi };
        kpiDefinitions.forEach(def => {
          if (newKpi[def.id] === undefined) newKpi[def.id] = def.maxScore; 
        });
        return { ...prev, kpi: newKpi };
      });
    }
  }, [kpiDefinitions]);

  // --- Auth Actions ---
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("登入失敗", error);
      alert("登入失敗，請稍後再試");
    }
  };

  const handleLogout = async () => {
    if(confirm("確定要登出系統嗎？")) {
      await signOut(auth);
    }
  };

  // --- Logic ---
  const calculatedResult = useMemo(() => {
    if (!currentSlip.empId || employees.length === 0 || jobRoles.length === 0) return null;
    
    const emp = employees.find(e => e.id === currentSlip.empId);
    if (!emp) return null;

    const roleConfig = jobRoles.find(r => r.id === emp.roleId) || jobRoles[0];
    const isPartTime = roleConfig.type === 'parttime';

    const numCases = Number(currentSlip.cases) || 0;
    const numNewCases = Number(currentSlip.newCases) || 0;
    const numPenaltyPoints = Number(currentSlip.penaltyPoints) || 0;

    let baseTotal = 0, positionAllowance = 0, performanceBonus = 0;

    if (isPartTime) {
      const hoursPerCase = roleConfig.hoursPerCase || 2;
      const hourlyRate = roleConfig.hourlyRate || 0;
      performanceBonus = numCases * hoursPerCase * hourlyRate;
    } else {
      baseTotal = parseInt(roleConfig.baseSalary) + GLOBAL_CONSTANTS.MEAL_ALLOWANCE;
      positionAllowance = roleConfig.levelAllowances[emp.level] !== undefined 
        ? parseInt(roleConfig.levelAllowances[emp.level]) : 0;
      let bonusCases = Math.max(0, numCases - roleConfig.baseQuota);
      performanceBonus = bonusCases * roleConfig.overQuotaRate;
    }

    const businessBonus = numNewCases * roleConfig.newCaseBonus;
    
    let penaltyStatus = '正常', bonusDiscount = 1; 
    if (numPenaltyPoints >= 5) { penaltyStatus = '紅牌 (獎金取消)'; bonusDiscount = 0; }
    else if (numPenaltyPoints >= 3) { penaltyStatus = '黃牌 (獎金八折)'; bonusDiscount = 0.8; }

    const finalPerformanceBonus = performanceBonus * bonusDiscount;
    const totalBonus = finalPerformanceBonus + businessBonus;

    let kpiScore = 0, maxPossibleScore = 0;
    kpiDefinitions.forEach(def => {
      const score = currentSlip.kpi[def.id] !== undefined ? currentSlip.kpi[def.id] : 0;
      kpiScore += score;
      maxPossibleScore += def.maxScore;
    });

    const kpiStatus = kpiScore < 70 ? '不及格 (需輔導)' : '及格';
    const grossSalary = baseTotal + positionAllowance + totalBonus;
    const insurance = calculateInsurance(grossSalary, roleConfig.type, roleConfig.baseSalary);
    const netSalary = grossSalary - insurance.totalEmpCost;

    return {
      emp, roleConfig, isPartTime, baseTotal, positionAllowance, performanceBonus, 
      finalPerformanceBonus, businessBonus, totalBonus, grossSalary, netSalary, 
      insurance, penaltyStatus, kpiScore, maxPossibleScore, kpiStatus,
      cleanData: { cases: numCases, newCases: numNewCases, penaltyPoints: numPenaltyPoints }
    };
  }, [currentSlip, employees, kpiDefinitions, jobRoles]);

  // --- CRUD Actions ---
  const handleSaveRecord = async () => {
    if (!calculatedResult) return;
    try {
      const newRecord = {
        empId: currentSlip.empId,
        month: currentSlip.month,
        roleType: calculatedResult.roleConfig.type,
        createdAt: serverTimestamp(),
        createdBy: user.email, // 紀錄是誰建立的
        data: { ...currentSlip, ...calculatedResult.cleanData },
        result: { 
          grossSalary: calculatedResult.grossSalary,
          netSalary: calculatedResult.netSalary,
          kpiScore: calculatedResult.kpiScore,
          compCost: calculatedResult.insurance.totalCompCost
        }
      };
      await addDoc(collection(db, 'records'), newRecord);
      alert(`✅ 資料已雲端儲存！\n員工：${calculatedResult.emp.name}\n實領：$${calculatedResult.netSalary.toLocaleString()}`);
    } catch (e) { console.error(e); alert("儲存失敗，請檢查權限"); }
  };

  const handleDeleteRecord = async (id) => { if(confirm('確定刪除？')) await deleteDoc(doc(db, 'records', id)); };
  const handleAddEmployee = async (e) => {
    e.preventDefault(); const { name, roleId, level, title } = e.target.elements;
    await addDoc(collection(db, 'employees'), { name: name.value, roleId: roleId.value, level: level.value, title: title.value });
    e.target.reset();
  };
  const handleDeleteEmployee = async (id) => { if(confirm('確定刪除？')) await deleteDoc(doc(db, 'employees', id)); };
  const handleSaveRole = async (e) => {
    e.preventDefault(); const formData = new FormData(e.target); const type = formData.get('type');
    const roleData = {
      name: formData.get('name'), type, newCaseBonus: parseInt(formData.get('newCaseBonus')) || 0,
      baseSalary: type === 'fulltime' ? parseInt(formData.get('baseSalary')) : 0,
      baseQuota: type === 'fulltime' ? parseInt(formData.get('baseQuota')) : 0,
      overQuotaRate: type === 'fulltime' ? parseInt(formData.get('overQuotaRate')) : 0,
      levelAllowances: { 'C': parseInt(formData.get('level_C'))||0, 'B': parseInt(formData.get('level_B'))||0, 'A': parseInt(formData.get('level_A'))||0 },
      hourlyRate: type === 'parttime' ? parseInt(formData.get('hourlyRate')) : 0,
      hoursPerCase: type === 'parttime' ? parseInt(formData.get('hoursPerCase')) : 0,
      order: Date.now()
    };
    if (editingRole) { await updateDoc(doc(db, 'job_roles', editingRole.id), roleData); setEditingRole(null); } 
    else { await addDoc(collection(db, 'job_roles'), roleData); }
    e.target.reset();
  };
  const handleDeleteRole = async (id) => { if (jobRoles.length <= 1) return alert("保留一筆"); if(confirm('刪除？')) await deleteDoc(doc(db, 'job_roles', id)); };
  const handleAddKpi = async (e) => {
    e.preventDefault(); const { label, maxScore, category, placeholder } = e.target.elements;
    await addDoc(collection(db, 'kpi_definitions'), { label: label.value, maxScore: parseInt(maxScore.value), category: category.value, placeholder: placeholder.value, order: Date.now() });
    e.target.reset();
  };
  const handleDeleteKpi = async (id) => { if(confirm('刪除？')) await deleteDoc(doc(db, 'kpi_definitions', id)); };
  const handleNumChange = (field, value) => { const val = value; if (val === '' || !isNaN(val)) setCurrentSlip(prev => ({ ...prev, [field]: val })); };
  const handleKpiScoreChange = (id, value) => { setCurrentSlip(prev => ({ ...prev, kpi: { ...prev.kpi, [id]: value } })); };

  // --- Render ---
  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10"/></div>;
  
  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const renderContent = () => {
    if (dataLoading) return <div className="flex h-64 items-center justify-center text-blue-600"><Loader2 className="animate-spin w-10 h-10"/><span className="ml-2">連線資料庫中...</span></div>;

    if (activeTab === 'dashboard') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthRecords = records.filter(r => r.month === currentMonth);
      const fullTimeRecords = monthRecords.filter(r => r.roleType !== 'parttime');
      const partTimeRecords = monthRecords.filter(r => r.roleType === 'parttime');
      const totalPayout = monthRecords.reduce((sum, r) => sum + r.result.grossSalary, 0);

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 bg-blue-50 border-blue-200">
              <h3 className="text-gray-500 text-sm font-medium">本月總發放薪資 (預估)</h3>
              <p className="text-3xl font-bold text-blue-700 mt-2">${totalPayout.toLocaleString()}</p>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-blue-600 bg-blue-100 px-2 py-1 rounded">正職: ${fullTimeRecords.reduce((sum, r) => sum + r.result.grossSalary, 0).toLocaleString()}</span>
                <span className="text-teal-600 bg-teal-100 px-2 py-1 rounded">兼職: ${partTimeRecords.reduce((sum, r) => sum + r.result.grossSalary, 0).toLocaleString()}</span>
              </div>
            </Card>
            <Card className="p-6 bg-green-50 border-green-200">
              <h3 className="text-gray-500 text-sm font-medium">已結算人數</h3>
              <div className="flex items-baseline gap-2 mt-2">
                 <span className="text-3xl font-bold text-green-700">{monthRecords.length}</span>
                 <span className="text-sm text-gray-500">/ {employees.length} 人</span>
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-green-800">正職: {fullTimeRecords.length}</span>
                <span className="text-green-800">兼職: {partTimeRecords.length}</span>
              </div>
            </Card>
             <Card className="p-6 bg-purple-50 border-purple-200">
              <h3 className="text-gray-500 text-sm font-medium">平均每人產值 (薪資)</h3>
              <p className="text-3xl font-bold text-purple-700 mt-2">
                ${monthRecords.length ? Math.round(totalPayout / monthRecords.length).toLocaleString() : 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">含正職與兼職</p>
            </Card>
          </div>
          
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Cloud className="w-5 h-5 mr-2 text-blue-500" /> 近期雲端紀錄
          </h3>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-700 font-bold">
                <tr>
                  <th className="px-6 py-3">月份</th>
                  <th className="px-6 py-3">類型</th>
                  <th className="px-6 py-3">姓名</th>
                  <th className="px-6 py-3">應發薪資</th>
                  <th className="px-6 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {records.map(record => {
                  const emp = employees.find(e => e.id === record.empId);
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">{record.month}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${record.roleType === 'parttime' ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'}`}>
                            {record.roleType === 'parttime' ? '兼職' : '正職'}
                        </span>
                      </td>
                      <td className="px-6 py-3">{emp ? emp.name : '已離職'}</td>
                      <td className="px-6 py-3 font-medium">${record.result.grossSalary.toLocaleString()}</td>
                      <td className="px-6 py-3">
                        <button onClick={() => handleDeleteRecord(record.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeTab === 'calculator') {
      const quantitativeKpis = kpiDefinitions.filter(k => k.category === 'quantitative');
      const qualitativeKpis = kpiDefinitions.filter(k => k.category === 'qualitative');

      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <Calculator className="w-5 h-5 mr-2" /> 1. 基本資料輸入
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">選擇員工</label>
                  <select 
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                    value={currentSlip.empId}
                    onChange={(e) => setCurrentSlip({...currentSlip, empId: e.target.value})}
                  >
                    <option value="">請選擇...</option>
                    {employees.map(e => {
                       const role = jobRoles.find(r => r.id === e.roleId);
                       const typeLabel = role?.type === 'parttime' ? '(兼職)' : '(正職)';
                       return (
                        <option key={e.id} value={e.id}>{e.name} {typeLabel}</option>
                       );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">計算月份</label>
                  <input 
                    type="month" 
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                    value={currentSlip.month}
                    onChange={(e) => setCurrentSlip({...currentSlip, month: e.target.value})}
                  />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">臨場場次</label>
                  <input type="number" min="0" className="w-full border-gray-300 rounded-md shadow-sm p-2 border" value={currentSlip.cases} onChange={(e) => handleNumChange('cases', e.target.value)} />
                  {calculatedResult && (
                    <p className="text-xs text-blue-600 mt-1">
                      {calculatedResult.isPartTime ? 
                        `時薪$${calculatedResult.roleConfig.hourlyRate} × ${calculatedResult.roleConfig.hoursPerCase}hr` : 
                        `責任額: ${calculatedResult.roleConfig.baseQuota}場`}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">新開發案件</label>
                  <input type="number" min="0" className="w-full border-gray-300 rounded-md shadow-sm p-2 border" value={currentSlip.newCases} onChange={(e) => handleNumChange('newCases', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-600 mb-1">違規扣點</label>
                  <input type="number" min="0" className="w-full border-red-300 text-red-600 rounded-md shadow-sm p-2 border" value={currentSlip.penaltyPoints} onChange={(e) => handleNumChange('penaltyPoints', e.target.value)} />
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><CheckCircle className="w-5 h-5 mr-2" /> 2. 績效考核 (KPI)</h3>
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-md mb-2">
                  <h4 className="font-bold text-blue-800 text-sm mb-2">定量指標</h4>
                  {quantitativeKpis.map(kpi => (
                    <KPIInput key={kpi.id} label={`${kpi.label} (Max ${kpi.maxScore})`} maxScore={kpi.maxScore} value={currentSlip.kpi[kpi.id] !== undefined ? currentSlip.kpi[kpi.id] : kpi.maxScore} onChange={(v) => handleKpiScoreChange(kpi.id, v)} placeholder={kpi.placeholder} />
                  ))}
                </div>
                <div className="bg-green-50 p-3 rounded-md">
                  <h4 className="font-bold text-green-800 text-sm mb-2">定性指標</h4>
                  {qualitativeKpis.map(kpi => (
                    <KPIInput key={kpi.id} label={`${kpi.label} (Max ${kpi.maxScore})`} maxScore={kpi.maxScore} value={currentSlip.kpi[kpi.id] !== undefined ? currentSlip.kpi[kpi.id] : kpi.maxScore} onChange={(v) => handleKpiScoreChange(kpi.id, v)} placeholder={kpi.placeholder} />
                  ))}
                </div>
              </div>
            </Card>
          </div>
          <div className="space-y-6">
            {calculatedResult ? (
              <>
                <Card className={`p-6 border-t-4 ${calculatedResult.isPartTime ? 'border-t-teal-500' : 'border-t-blue-600'}`}>
                  <div className="flex justify-between items-center mb-6">
                    <div><h3 className="text-xl font-bold text-gray-900">薪資試算單</h3><p className="text-sm text-gray-500">{calculatedResult.roleConfig.name}</p></div>
                    <span className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-600">{currentSlip.month}</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    {!calculatedResult.isPartTime && (
                      <>
                        <div className="flex justify-between text-gray-700"><span>職等津貼 ({calculatedResult.emp.level}級)</span><span>${calculatedResult.positionAllowance.toLocaleString()}</span></div>
                        <div className="border-b border-gray-100 my-2"></div>
                        <div className="flex justify-between font-medium"><span>固定薪資</span><span>${calculatedResult.baseTotal.toLocaleString()}</span></div>
                      </>
                    )}
                    <div className="flex justify-between items-center">
                      <span>{calculatedResult.isPartTime ? '臨場服務費' : '變動績效獎金'}</span>
                      <span className={calculatedResult.penaltyStatus.includes('紅') ? 'text-red-500 line-through' : ''}>${calculatedResult.performanceBonus.toLocaleString()}</span>
                    </div>
                    {calculatedResult.performanceBonus !== calculatedResult.finalPerformanceBonus && <div className="flex justify-between text-red-500 text-xs pl-4"><span>↳ 扣點懲罰</span><span>${calculatedResult.finalPerformanceBonus.toLocaleString()}</span></div>}
                    <div className="flex justify-between"><span>業務獎金</span><span>${calculatedResult.businessBonus.toLocaleString()}</span></div>
                    <div className="border-b-2 border-gray-200 my-3"></div>
                    <div className="flex justify-between text-lg font-bold text-gray-900"><span>應發金額 (Gross)</span><span>${calculatedResult.grossSalary.toLocaleString()}</span></div>
                    <div className="bg-red-50 p-3 rounded mt-2 text-xs text-red-800"><p className="font-bold">雇主成本 (隱藏):</p><div className="flex justify-between"><span>總支出</span><span>${(calculatedResult.grossSalary + calculatedResult.insurance.totalCompCost).toLocaleString()}</span></div></div>
                  </div>
                  <div className="mt-6 flex gap-3"><button onClick={handleSaveRecord} className={`flex-1 text-white py-2 px-4 rounded-md flex items-center justify-center gap-2 ${calculatedResult.isPartTime ? 'bg-teal-600 hover:bg-teal-700' : 'bg-blue-600 hover:bg-blue-700'}`}><Save className="w-4 h-4" /> 儲存資料</button></div>
                </Card>
                <Card className="p-6"><h3 className="font-bold text-gray-800 mb-2">考核結果</h3><div className="flex items-center gap-4"><div className={`text-4xl font-bold ${calculatedResult.kpiScore >= 70 ? 'text-green-600' : 'text-red-600'}`}>{calculatedResult.kpiScore}<span className="text-sm ml-1">/ {calculatedResult.maxPossibleScore}</span></div></div></Card>
              </>
            ) : <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed rounded-lg p-10"><AlertTriangle className="w-10 h-10 mb-2" /><p>請先選擇員工</p></div>}
          </div>
        </div>
      );
    }

    if (activeTab === 'reports') {
      const employeeStats = employees.map(emp => {
        const empRecords = records.filter(r => r.empId === emp.id);
        const recordCount = empRecords.length;
        const totalIncome = empRecords.reduce((sum, r) => sum + r.result.grossSalary, 0);
        const totalCases = empRecords.reduce((sum, r) => sum + r.data.cases, 0);
        const avgKpi = recordCount ? (empRecords.reduce((sum, r) => sum + r.result.kpiScore, 0) / recordCount).toFixed(1) : 0;
        const avgCases = recordCount ? (totalCases / recordCount).toFixed(1) : 0;
        const avgIncome = recordCount ? Math.round(totalIncome / recordCount) : 0;
        const role = jobRoles.find(r => r.id === emp.roleId);
        return { ...emp, roleName: role?.name || '未知', roleType: role?.type, totalIncome, avgKpi, totalCases, avgCases, avgIncome, recordCount };
      });

      return (
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-gray-800">年度人員總表</h3>
          <div className="grid grid-cols-1 gap-4">
            {employeeStats.map(stat => (
              <Card key={stat.id} className="p-4 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl ${stat.roleType === 'parttime' ? 'bg-teal-500' : (stat.level === 'A' ? 'bg-purple-600' : 'bg-blue-600')}`}>{stat.roleType === 'parttime' ? 'PT' : stat.level}</div>
                    <div><h4 className="font-bold text-lg">{stat.name} <span className="text-sm text-gray-500 font-normal">({stat.title})</span></h4><p className={`text-sm font-medium ${stat.roleType === 'parttime' ? 'text-teal-600' : 'text-blue-600'}`}>{stat.roleName}</p></div>
                  </div>
                  <div className="flex gap-8 text-center"><div><p className="text-xs text-gray-500">平均 KPI</p><p className={`font-bold text-2xl ${parseFloat(stat.avgKpi) >= 70 ? 'text-green-600' : 'text-red-600'}`}>{stat.avgKpi}</p></div></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="bg-gray-50 p-2 rounded"><p className="text-xs text-gray-500 mb-1">年度總場次</p><p className="font-bold text-lg text-gray-800">{stat.totalCases} 場</p></div>
                  <div className="bg-gray-50 p-2 rounded"><p className="text-xs text-gray-500 mb-1">年度薪資</p><p className="font-bold text-lg text-gray-800">${stat.totalIncome.toLocaleString()}</p></div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    if (activeTab === 'employees') {
        return (
            <div className="space-y-6">
                <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">新增員工 (雲端)</h3>
                    <form onSubmit={handleAddEmployee} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full"><label className="block text-xs">姓名</label><input name="name" required className="w-full border rounded p-2"/></div>
                        <div className="flex-1 w-full">
                            <label className="block text-xs">職務</label>
                            <select name="roleId" className="w-full border rounded p-2 bg-blue-50">
                                {jobRoles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.type === 'parttime' ? '兼職' : '正職'})</option>)}
                            </select>
                        </div>
                        <div className="flex-1 w-full"><label className="block text-xs">職稱</label><input name="title" required className="w-full border rounded p-2"/></div>
                        <div className="w-full md:w-32"><label className="block text-xs">職等</label><select name="level" className="w-full border rounded p-2"><option value="C">C</option><option value="B">B</option><option value="A">A</option></select></div>
                        <button className="bg-blue-600 text-white px-4 py-2 rounded">新增</button>
                    </form>
                </Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {employees.map(e => (
                        <Card key={e.id} className="p-4 flex justify-between items-center">
                            <div><p className="font-bold">{e.name}</p><p className="text-sm text-gray-500">{e.title}</p></div>
                            <button onClick={() => handleDeleteEmployee(e.id)} className="text-red-500"><Trash2 className="w-4 h-4"/></button>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (activeTab === 'settings') {
      return (
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center"><Briefcase className="w-5 h-5 mr-2" /> 職務薪資結構設定</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6 md:col-span-1 h-fit bg-blue-50 border-blue-200">
                <h4 className="font-bold text-blue-800 mb-4 flex items-center">{editingRole ? <Edit3 className="w-4 h-4 mr-2"/> : <Plus className="w-4 h-4 mr-2"/>}{editingRole ? '編輯職務' : '新增職務'}</h4>
                <form onSubmit={handleSaveRole} className="space-y-3">
                  <div><label className="block text-xs font-bold text-gray-700">職務名稱</label><input name="name" defaultValue={editingRole?.name} required className="w-full border rounded p-2 text-sm" placeholder="例：特約護理師" /></div>
                  <div><label className="block text-xs font-bold text-gray-700">聘用類型</label>
                    <div className="flex gap-2 mt-1">
                        <label className="flex items-center gap-1"><input type="radio" name="type" value="fulltime" defaultChecked={!editingRole || editingRole.type === 'fulltime'} /><span className="text-sm">正職</span></label>
                        <label className="flex items-center gap-1"><input type="radio" name="type" value="parttime" defaultChecked={editingRole?.type === 'parttime'} /><span className="text-sm">兼職</span></label>
                    </div>
                  </div>
                  <div className="border-t border-blue-200 pt-2 my-2"><p className="text-xs font-bold text-blue-800 mb-2">正職參數 (底薪/責任額)</p><div className="grid grid-cols-2 gap-2"><div><label className="block text-xs text-gray-600">底薪</label><input name="baseSalary" type="number" defaultValue={editingRole?.baseSalary} className="w-full border rounded p-2 text-sm" /></div><div><label className="block text-xs text-gray-600">責任額</label><input name="baseQuota" type="number" defaultValue={editingRole?.baseQuota} className="w-full border rounded p-2 text-sm" /></div></div>
                  <div className="mt-2"><label className="block text-xs text-gray-600">超額單價</label><input name="overQuotaRate" type="number" defaultValue={editingRole?.overQuotaRate} className="w-full border rounded p-2 text-sm" /></div>
                  <div className="bg-white p-2 rounded border border-blue-100 mt-2"><label className="block text-xs font-bold text-gray-700 mb-2">職等津貼</label><div className="flex gap-2"><input name="level_C" type="number" placeholder="C級" defaultValue={editingRole?.levelAllowances?.C} className="w-full border rounded p-1 text-xs" /><input name="level_B" type="number" placeholder="B級" defaultValue={editingRole?.levelAllowances?.B} className="w-full border rounded p-1 text-xs" /><input name="level_A" type="number" placeholder="A級" defaultValue={editingRole?.levelAllowances?.A} className="w-full border rounded p-1 text-xs" /></div></div></div>
                  <div className="border-t border-blue-200 pt-2 my-2"><p className="text-xs font-bold text-teal-800 mb-2">兼職參數 (時薪)</p><div className="grid grid-cols-2 gap-2"><div><label className="block text-xs text-gray-600">時薪</label><input name="hourlyRate" type="number" defaultValue={editingRole?.hourlyRate} className="w-full border rounded p-2 text-sm" /></div><div><label className="block text-xs text-gray-600">每場時數</label><input name="hoursPerCase" type="number" defaultValue={editingRole?.hoursPerCase || 2} className="w-full border rounded p-2 text-sm" /></div></div></div>
                  <div><label className="block text-xs font-bold text-gray-700">新案獎金</label><input name="newCaseBonus" type="number" defaultValue={editingRole?.newCaseBonus} required className="w-full border rounded p-2 text-sm" /></div>
                  <div className="flex gap-2">{editingRole && <button type="button" onClick={() => setEditingRole(null)} className="flex-1 bg-gray-400 text-white py-2 rounded text-sm">取消</button>}<button className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm">{editingRole ? '儲存' : '新增'}</button></div>
                </form>
              </Card>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobRoles.map(role => (
                  <Card key={role.id} className={`p-4 relative ${editingRole?.id === role.id ? 'ring-2 ring-blue-500' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2"><h4 className="font-bold text-lg text-gray-800">{role.name}</h4><span className={`text-xs px-2 py-0.5 rounded ${role.type === 'parttime' ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'}`}>{role.type === 'parttime' ? '兼職' : '正職'}</span></div>
                      <div className="flex gap-1"><button onClick={() => setEditingRole(role)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit3 className="w-4 h-4"/></button><button onClick={() => handleDeleteRole(role.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button></div>
                    </div>
                    <div className="text-sm space-y-1 text-gray-600">
                      {role.type === 'fulltime' ? (<><p>底薪: ${role.baseSalary}</p><p>責任額: {role.baseQuota} 場</p></>) : (<><p>時薪: ${role.hourlyRate}</p><p>每場: {role.hoursPerCase} 小時</p></>)}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
          <hr className="border-gray-300"/>
          <div className="space-y-4">
             <h3 className="text-xl font-bold text-gray-800 flex items-center"><CheckCircle className="w-5 h-5 mr-2" /> KPI 設定</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Card className="p-6 md:col-span-1 h-fit">
                    <h4 className="font-bold text-gray-700 mb-4 flex items-center"><Plus className="w-4 h-4 mr-2"/> 新增指標</h4>
                    <form onSubmit={handleAddKpi} className="space-y-4">
                       <div><label className="block text-sm font-medium text-gray-700 mb-1">名稱</label><input name="label" required className="w-full border rounded p-2" placeholder="例：團隊合作" /></div>
                       <div><label className="block text-sm font-medium text-gray-700 mb-1">配分</label><input name="maxScore" type="number" required min="1" className="w-full border rounded p-2" placeholder="10" /></div>
                       <div><label className="block text-sm font-medium text-gray-700 mb-1">類別</label><select name="category" className="w-full border rounded p-2"><option value="quantitative">定量</option><option value="qualitative">定性</option></select></div>
                       <button className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">新增</button>
                    </form>
                 </Card>
                 <div className="md:col-span-2 space-y-3">
                    {kpiDefinitions.map(kpi => (
                       <div key={kpi.id} className="bg-white border rounded-lg p-3 flex justify-between items-center">
                          <div><span className={`text-xs px-2 py-1 rounded mr-2 ${kpi.category === 'quantitative' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{kpi.category === 'quantitative' ? '定量' : '定性'}</span><span className="font-bold text-gray-800">{kpi.label}</span><span className="text-sm text-gray-500 ml-2">(Max {kpi.maxScore})</span></div>
                          <button onClick={() => handleDeleteKpi(kpi.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                       </div>
                    ))}
                 </div>
             </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      <div className="bg-slate-800 text-white p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <div className="bg-blue-500 p-2 rounded-lg"><Activity className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-xl font-bold">安澤健康顧問</h1><p className="text-xs text-slate-400">薪資系統 v3.1 (Google 登入版)</p></div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {[{ id: 'dashboard', label: '總覽', icon: BarChart3 }, { id: 'calculator', label: '計算', icon: Calculator }, { id: 'reports', label: '報表', icon: TrendingUp }, { id: 'employees', label: '人員', icon: Users }, { id: 'settings', label: '設定', icon: Settings }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
              <tab.icon className="w-4 h-4" /><span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
          <div className="h-6 w-px bg-slate-600 mx-2"></div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-md text-red-300 hover:bg-red-900/50 hover:text-red-100" title="登出">
             <LogOut className="w-4 h-4" /><span className="hidden md:inline">登出</span>
          </button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto p-4 md:p-8">{renderContent()}</div>
    </div>
  );
}