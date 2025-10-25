// SlottrolleyModal.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import MixIcon from "@mui/icons-material/Blender";
import RefreshIcon from "@mui/icons-material/Refresh";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import {
  AppBar,
  Backdrop,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
  Alert,
  IconButton,
} from "@mui/material";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

const Modal4 = ({ open, onClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [selectedWeights, setSelectedWeights] = useState({});

  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch materials from new API
  const fetchMaterials = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/prep/getRMMixBatch`);
      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        setMaterials(res.data.data);
      } else {
        setMaterials([]);
        showSnackbar("ไม่พบรายการวัตถุดิบ", "warning");
      }
    } catch (err) {
      console.error("fetchMaterials error", err);
      showSnackbar("ไม่สามารถดึงข้อมูลวัตถุดิบได้", "error");
      setMaterials([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMaterials();
    }
  }, [open]);

  const showSnackbar = (msg, severity = "info") => {
    setSnackbarMsg(msg);
    setSnackbarSeverity(severity);
    setOpenSnackbar(true);
  };

  const onWeightChange = (rmfbatch_id, value) => {
    const numValue = parseFloat(value) || 0;
    const material = materials.find(m => m.rmfbatch_id === rmfbatch_id);
    
    if (material && numValue > material.weight) {
      showSnackbar(`น้ำหนักไม่สามารถเกิน ${material.weight} กก.`, "warning");
      return;
    }

    setSelectedWeights(prev => ({
      ...prev,
      [rmfbatch_id]: numValue
    }));
  };

  const onRefresh = async () => {
    await fetchMaterials();
    setSelectedWeights({});
    showSnackbar("อัปเดตข้อมูลแล้ว", "success");
  };

  const getSelectedMaterials = () => {
    return materials.filter(m => 
      selectedWeights[m.rmfbatch_id] && selectedWeights[m.rmfbatch_id] > 0
    );
  };

  const getTotalWeight = () => {
    return Object.values(selectedWeights).reduce((sum, weight) => sum + (weight || 0), 0);
  };

  // const onMixClick = () => {
  //   const selectedMaterials = getSelectedMaterials();
  //   if (selectedMaterials.length === 0) {
  //     showSnackbar("กรุณาเลือกวัตถุดิบและกรอกน้ำหนักอย่างน้อย 1 รายการ", "warning");
  //     return;
  //   }
  //   setConfirmOpen(true);
  // };

  const onMixClick = () => {
  const selectedMaterials = getSelectedMaterials();
  if (selectedMaterials.length === 0) {
    showSnackbar("กรุณาเลือกวัตถุดิบและกรอกน้ำหนักอย่างน้อย 1 รายการ", "warning");
    return;
  }

  // ส่งข้อมูลกลับ parent และเปิด CameraActivationModal
  handleClose();
};


  const submitMix = async () => {
    setIsSubmitting(true);
    try {
      const selectedMaterials = getSelectedMaterials();
      const payload = {
        materials: selectedMaterials.map(material => ({
          rmfbatch_id: material.rmfbatch_id,
          mat: material.mat,
          batch: material.batch,
          weight: selectedWeights[material.rmfbatch_id],
          level_eu: material.level_eu
        }))
      };

      const res = await axios.post(`${API_URL}/api/prep/mix/emulsions`, payload);

  if (res.data && res.data.success) {
  showSnackbar("ผสมวัตถุดิบสำเร็จ", "success");
  await fetchMaterials();
  setSelectedWeights({});
  setConfirmOpen(false);
  if (typeof onSuccess === "function") onSuccess();

  // ส่งกลับ selected materials + total weight
  handleClose();
} else {
        showSnackbar(res.data.message || "เกิดข้อผิดพลาดขณะผสม", "error");
      }
    } catch (err) {
      console.error("submitMix error", err);
      showSnackbar(
        err?.response?.data?.error || err?.response?.data?.message || err.message,
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // แก้ onClose ภายใน Modal4
const handleClose = () => {
  const selectedMaterials = getSelectedMaterials().map(material => ({
    rmfbatch_id: material.rmfbatch_id,
    mat: material.mat,
    batch: material.batch,
    weight: selectedWeights[material.rmfbatch_id],
    level_eu: material.level_eu
  }));

  const totalWeight = getTotalWeight();

  // ส่งกลับไป parent
  if (typeof onClose === "function") {
    onClose({ selectedMaterials, totalWeight });
  }
};


  return (
    <Fade in={open}>
      <Backdrop
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={open}
        onClick={(e) => e.stopPropagation()}
      >
        <Paper
          elevation={8}
          className="bg-white rounded-lg shadow-lg w-[1200px] h-[700px] overflow-hidden flex flex-col"
          style={{ color: "#585858" }}
        >
          <AppBar position="static" sx={{ backgroundColor: "#4e73df" }}>
            <Toolbar sx={{ minHeight: "50px", px: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <WarehouseIcon sx={{ mr: 1 }} />
                <Typography variant="h6">การผสมวัตถุดิบ</Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton color="inherit" onClick={onRefresh} disabled={isLoading}>
                {isLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  <RefreshIcon />
                )}
              </IconButton>
            </Toolbar>
          </AppBar>

          {/* Content */}
          <Box sx={{ flex: 1, p: 2, overflow: "auto" }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              รายการวัตถุดิบ
            </Typography>
            
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ backgroundColor: "#f8f9fc" }}>
                  <TableRow>
                    <TableCell align="center">ลำดับ</TableCell>
                    <TableCell>รหัสวัตถุดิบ</TableCell>
                    <TableCell>batch</TableCell>
                    <TableCell align="right">น้ำหนักคงเหลือ (กก.)</TableCell>
                    <TableCell>ระดับ EU</TableCell>
                    <TableCell>วันที่เบิก</TableCell>
                    <TableCell align="center">น้ำหนักที่เลือก (กก.)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {materials.map((item, index) => (
                    <TableRow key={item.rmfbatch_id}>
                      <TableCell align="center">{index + 1}</TableCell>
                      <TableCell>{item.mat}</TableCell>
                      <TableCell>{item.batch}</TableCell>
                      <TableCell align="right">{item.weight.toFixed(2)}</TableCell>
                      <TableCell>{item.level_eu}</TableCell>
                      <TableCell>
                        {new Date(item.withdraw_date).toLocaleString('th-TH')}
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          size="small"
                          type="number"
                          value={selectedWeights[item.rmfbatch_id] || ""}
                          onChange={(e) => onWeightChange(item.rmfbatch_id, e.target.value)}
                          inputProps={{ 
                            step: "0.01", 
                            min: "0",
                            max: item.weight.toString()
                          }}
                          sx={{ width: 120 }}
                          placeholder="0.00"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {materials.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        {isLoading ? "กำลังโหลดข้อมูล..." : "ไม่มีรายการวัตถุดิบ"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Summary */}
            <Box 
              sx={{ 
                mt: 2, 
                p: 2, 
                backgroundColor: "#f8f9fc", 
                borderRadius: 1,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <Typography variant="h6">
                จำนวนรายการที่เลือก: {getSelectedMaterials().length} รายการ
              </Typography>
              <Typography variant="h6" color="primary">
                น้ำหนักรวม: {getTotalWeight().toFixed(2)} กก.
              </Typography>
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: "flex", gap: 2, mt: 2, justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                startIcon={<MixIcon />}
                onClick={onMixClick}
                disabled={isSubmitting || getSelectedMaterials().length === 0}
                size="large"
              >
                ผสมวัตถุดิบ
              </Button>
           <Button
  variant="outlined"
  startIcon={<CancelIcon />}
  onClick={handleClose}
  disabled={isSubmitting}
  size="large"
>
  ยกเลิก
</Button>

            </Box>
          </Box>

          {/* Confirm Dialog */}
          <Dialog
            open={confirmOpen}
            onClose={() => !isSubmitting && setConfirmOpen(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>ยืนยันการผสมวัตถุดิบ</DialogTitle>
            <DialogContent>
              <Typography variant="body1" sx={{ mb: 2, fontWeight: "bold" }}>
                รายการที่จะผสม:
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ backgroundColor: "#f8f9fc" }}>
                    <TableRow>
                      <TableCell>ลำดับ</TableCell>
                      <TableCell>รหัสวัตถุดิบ</TableCell>
                      <TableCell>batch</TableCell>
                      <TableCell>ระดับ EU</TableCell>
                      <TableCell align="right">น้ำหนัก (กก.)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getSelectedMaterials().map((material, idx) => (
                      <TableRow key={`confirm-${material.rmfbatch_id}`}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{material.mat}</TableCell>
                        <TableCell>{material.batch}</TableCell>
                        <TableCell>{material.level_eu}</TableCell>
                        <TableCell align="right">
                          {selectedWeights[material.rmfbatch_id].toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ backgroundColor: "#f8f9fc" }}>
                      <TableCell colSpan={4} align="right" sx={{ fontWeight: "bold" }}>
                        น้ำหนักรวม:
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: "bold" }}>
                        {getTotalWeight().toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </DialogContent>
            <DialogActions>
              <Button 
                onClick={() => setConfirmOpen(false)}
                disabled={isSubmitting}
              >
                ยกเลิก
              </Button>
              <Button 
                onClick={submitMix} 
                variant="contained" 
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} /> : <MixIcon />}
              >
                {isSubmitting ? "กำลังผสม..." : "ยืนยันผสม"}
              </Button>
            </DialogActions>
          </Dialog>

          <Snackbar
            open={openSnackbar}
            autoHideDuration={3000}
            onClose={() => setOpenSnackbar(false)}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
          >
            <Alert
              onClose={() => setOpenSnackbar(false)}
              severity={snackbarSeverity}
              variant="filled"
            >
              {snackbarMsg}
            </Alert>
          </Snackbar>
        </Paper>
      </Backdrop>
    </Fade>
  );
};

export default Modal4;