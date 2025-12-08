import { Route, Routes } from "react-router-dom";

import SidebarPrep from "./SidebarPrep";
import MainProduction from "./Main/MainPage";
import HistoryCookedPage from "./HistoryCooked/HistoryCookedPage";
import MatManagePage from "./MatManage/MatManagePage";
import MatReworkPage from "./MatRework/MatReworkPage";
import ScanSAPPage from "./ScanSAP/ScanSAPPage";
import HistoryTranform from "./HistoryTranform/HistoryTranformPage";
import MatImportPage from "./MatImport/MatImportPage";
import ManageSelect from "../User/ManageSelect";
import HistoryPage from "./History/HistoryPage";
import WorkplaceSelector from "../User/WorkplaceSelector.jsx";
import BatchSAPPage from "./BatchSAP/BatchSAPPage.jsx";
import EmulsionPage from "./Emulsion/EmusionPage.jsx";
import RM_EMU from "./RMEmu/MainPage.jsx";
import BatchMIXPage from "./BatchMIX/BatchMIXPage.jsx";
import TraceBack_HU from "./TraceBackHU/MainPage.jsx";
import EditDataTrolley from "./EditDataTrolley/EditDataTrolley.jsx";

function AppPrep() {
  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      {/* BG */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 opacity-80" />
        <div className="absolute inset-0 backdrop-blur-sm" />
      </div>

      <SidebarPrep />
      <Routes>
        <Route path="/" element={<MainProduction />} />
        <Route
          path="/HistoryCooked/HistoryCookedPage"
          element={<HistoryCookedPage />}
        />
        <Route path="/MatManage/MatManagePage" element={<MatManagePage />} />
        <Route path="/MatRework/MatReworkPage" element={<MatReworkPage />} />
        <Route path="/ScanSAP/ScanSAPPage" element={<ScanSAPPage />} />
        <Route path="/MatImport/MatImportPage" element={<MatImportPage />} />
        <Route path="/WorkplaceSelector" element={<WorkplaceSelector />} />
        <Route path="/manageprep" element={<BatchSAPPage />} />
        <Route path="/HistoryTranform/HistoryTranformPage"element={<HistoryTranform />}/>
        <Route path="/User/SelectWP" element={<ManageSelect />} />
        <Route path="/RM_EMU" element={<RM_EMU/>} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/Emulsions" element={<EmulsionPage />} />
        <Route path="/BatchMIX" element={<BatchMIXPage />} />
        <Route path="/TraceBack_HU" element={<TraceBack_HU />} />
        <Route path="/EditDataTrolley" element={<EditDataTrolley />} />
      </Routes>
    </div>
  );
}

export default AppPrep;
