import React, { useState, useEffect, useRef, useCallback } from 'react';
import TableMainPrep from './TableOvenToCold';
import Modal1 from './Modal1';
import Modal2 from './Modal2';
import Modal3 from './Modal3';
import ModalEditPD from './ModalEditPD';
import ModalSuccess from './ModalSuccess';
import axios from "axios";
axios.defaults.withCredentials = true;
import io from 'socket.io-client';
const API_URL = import.meta.env.VITE_API_URL;

const ParentComponent = () => {
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openSuccessModal, setOpenSuccessModal] = useState(false);
  const [dataForModal1, setDataForModal1] = useState(null);
  const [dataForModal2, setDataForModal2] = useState(null);
  const [dataForModal3, setDataForModal3] = useState(null);
  const [dataForEditModal, setDataForEditModal] = useState(null);
  const [dataForSuccessModal, setDataForSuccessModal] = useState(null);
  const [tableData, setTableData] = useState({
    trolleys: [],
    summary: {
      totalEmpty: 0,
      totalOccupied: 0,
      totalTrolleys: 0
    }
  });
  const fetchTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  const [socket, setSocket] = useState(null);

  const rmTypeIdRaw = localStorage.getItem("rm_type_id");
  const rmTypeId = Array.isArray(rmTypeIdRaw)
    ? rmTypeIdRaw[0]
    : JSON.parse(rmTypeIdRaw)?.[0] ?? rmTypeIdRaw;

  console.log("rmTypeId (final):", rmTypeId);



  // Debounced fetchData
  const fetchDataDebounced = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    fetchTimeoutRef.current = setTimeout(() => {
      fetchData();
    }, 300);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/prep/EditDataTrolley/fetchAllTrolleys?rm_type_id=${rmTypeId}`);
      console.log("Trolley data fetched:", response.data);
      setTableData(response.data.success ? response.data.data : {
        trolleys: [],
        summary: {
          totalEmpty: 0,
          totalOccupied: 0,
          totalTrolleys: 0
        }
      });
    } catch (error) {
      console.error("Error fetching trolley data:", error);
    }
  }, []);

  useEffect(() => {
    // Initialize socket connection only once
    if (!socketRef.current) {
      const newSocket = io(API_URL, {
        transports: ["websocket"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        autoConnect: true
      });

      socketRef.current = newSocket;

      const handleDataUpdate = () => {
        console.log("Data updated event received");
        fetchDataDebounced();
      };

      newSocket.on('connect', () => {
        console.log('Socket connected');
        newSocket.emit('joinRoom', 'trolleyUpdateRoom');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });

      newSocket.on('trolleyUpdated', handleDataUpdate);
      newSocket.on('trolleyStatusChanged', handleDataUpdate);

      // Initial data fetch
      fetchData();
    }

    return () => {
      // Cleanup when component unmounts
      if (socketRef.current) {
        socketRef.current.off('trolleyUpdated');
        socketRef.current.off('trolleyStatusChanged');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [fetchData, fetchDataDebounced]);

  // const fetchData = async () => {
  //   try {
  //     const response = await axios.get(`${API_URL}/api/prep/main/fetchRMForProd`);
  //     console.log("Data fetched:", response.data);
  //     setTableData(response.data.success ? response.data.data : []);
  //   } catch (error) {
  //     console.error("Error fetching data:", error);
  //   }
  // };
  useEffect(() => {
    fetchData();
  }, []);

  const clearData = () => {
    setDataForModal1(null);
    setDataForModal2(null);
    setDataForModal3(null);
  };


  const handleOpenEditModal = (data) => {
    setDataForEditModal({
      mapping_id: data.mapping_id,
      batch: data.batch,
      mat: data.mat,
      mat_name: data.mat_name,
      production: data.production,
      line_name: data.line_name,        // เพิ่ม
      weight_RM: data.weight_RM || 0,         // เพิ่ม น้ำหนักปัจจุบัน
      trolley_number: data.trolley_number,  // เพิ่ม (ถ้ามี)
      tro_id: data.tro_id                     // เพิ่ม tro_id
    });
    setOpenEditModal(true);
  };

  const handleOpenSuccess = (data) => {
    setDataForSuccessModal({
      mapping_id: data.mapping_id,
      batch: data.batch,
      mat: data.mat,
      mat_name: data.mat_name,
      production: data.production,
      line_name: data.line_name,
      weight_RM: data.weight_RM || 0,
      trolley_number: data.trolley_number,
      tro_id: data.tro_id
    });
    setOpenSuccessModal(true);
  };

  const handleRowClick = (rowData) => {
    console.log("Row clicked:", rowData);
    // Add any logic to handle the row click event
  };


  return (
    <div>

      <TableMainPrep
        handleOpenEditModal={handleOpenEditModal}
        handleOpenSuccess={handleOpenSuccess}
        data={tableData}
      />
      <ModalEditPD
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        onNext={() => setOpenEditModal(false)}
        data={dataForEditModal}
        onSuccess={fetchData}
      />
      {/* <ModalSuccess
        open={openSuccessModal}
        onClose={() => setOpenSuccessModal(false)}
        mat={dataForSuccessModal?.mat}
        mat_name={dataForSuccessModal?.mat_name}
        batch={dataForSuccessModal?.batch}
        production={dataForSuccessModal?.production}
        rmfp_id={dataForSuccessModal?.rmfp_id}
        selectedPlans={dataForSuccessModal?.selectedPlans}
        onSuccess={fetchData}
      /> */}
    </div>
  );
};

export default ParentComponent;
