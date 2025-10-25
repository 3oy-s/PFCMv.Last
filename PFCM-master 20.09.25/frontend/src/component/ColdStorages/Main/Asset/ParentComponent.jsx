import React, { useState, useEffect } from 'react';
import TableMainPrep from './TableMainPrep';
import Modal1 from './Modal1';
import Modal2 from './Modal2';
import Modal3 from './Modal3';
import ModalEditPD from './ModalEditPD';
import ModalSuccess from './ModalSuccess';
import io from 'socket.io-client';
const API_URL = import.meta.env.VITE_API_URL;




const ParentComponent = () => {
  const [modalState, setModalState] = useState({
    modal1: { open: false, data: null },
    modal2: { open: false, data: null },
    modal3: { open: false, data: null },
    editModal: { open: false, data: null },
    successModal: { open: false, data: null },
  });
    const [socket, setSocket] = useState(null);
  const [tableData, setTableData] = useState([]);

  const handleOpenModal = (modal, data) => {
    setModalState(prevState => ({
      ...prevState,
      [modal]: { open: true, data }
    }));
  };

  const handleCloseModal = (modal) => {
    setModalState(prevState => ({
      ...prevState,
      [modal]: { open: false, data: null }
    }));
  };

  const handleRowClick = (rowData) => {
    console.log("Row clicked:", rowData);
  };


 // Initialize Socket.IO connection
 useEffect(() => {
  const newSocket = io(API_URL, {
        transports: ["websocket"],
        reconnectionAttempts: 5, // จำนวนครั้งที่ลอง reconnect
        reconnectionDelay: 1000, // หน่วงเวลา 1 วินาทีระหว่างการ reconnect
        autoConnect: true
      }); // Connect to the backend using Socket.IO
  setSocket(newSocket);
  newSocket.emit('joinRoom', 'QcCheckRoom');

 // Listen for the 'qcUpdated' event and trigger data fetch
 newSocket.on('qcUpdated', (data) => {
  console.log('QC data updated:', data);
  fetchData();  // Re-fetch the data when the event is received
});
  // Clean up socket connection when component unmounts
  return () => {
    newSocket.off('qcUpdated');
    newSocket.disconnect();
  };
}, []);


useEffect(() => {
  const fetchData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/coldstorages/scan/sap`, {
        credentials: "include",
      });

      const data = await response.json();

      if (Array.isArray(data)) {
        // ✅ API ส่งมาเป็น array ตรง ๆ
        setTableData(data);
      } else if (data.success) {
        // ✅ เผื่ออนาคต backend ห่อด้วย success/data
        setTableData(data.data);
      } else {
        console.error("API Error:", data.message || "Unknown error");
        setTableData([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setTableData([]);
    }
  };

  fetchData();
}, []);

  return (
    <div>
      <TableMainPrep 
        handleOpenModal={handleOpenModal} 
        handleOpenEditModal={(data) => handleOpenModal('editModal', data)}
        handleOpenSuccess={(data) => handleOpenModal('successModal', data)}
        data={tableData} 
        handleRowClick={handleRowClick}
      />
      <Modal1 
        open={modalState.modal1.open} 
        onClose={() => handleCloseModal('modal1')} 
        onNext={(data) => handleOpenModal('modal2', data)} 
        data={modalState.modal1.data}
      />
      <Modal2 
        open={modalState.modal2.open} 
        onClose={() => handleCloseModal('modal2')} 
        onNext={(data) => handleOpenModal('modal3', data)} 
        data={modalState.modal2.data}
      />
      <Modal3 
        open={modalState.modal3.open} 
        onClose={() => handleCloseModal('modal3')}  
        data={modalState.modal3.data} 
        onEdit={() => handleOpenModal('modal2', modalState.modal3.data)}
      />
      <ModalEditPD
        open={modalState.editModal.open}
        onClose={() => handleCloseModal('editModal')}
        onNext={(updatedData) => {
          // Handle the updated data here
          setModalState(prevState => ({
            ...prevState,
            editModal: { open: false, data: updatedData }
          }));
        }}
        data={modalState.editModal.data}
      />
      <ModalSuccess
        open={modalState.successModal.open}
        onClose={() => handleCloseModal('successModal')}
        mat={modalState.successModal.data?.mat}
        mat_name={modalState.successModal.data?.mat_name}
        batch={modalState.successModal.data?.batch}
        production={modalState.successModal.data?.production}
        rmfp_id={modalState.successModal.data?.rmfp_id}
        selectedPlans={modalState.successModal.data?.selectedPlans}
      />
    </div>
  );
};

export default ParentComponent;
