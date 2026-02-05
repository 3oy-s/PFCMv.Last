import React, { useState, useEffect } from 'react';
import { Table, TableContainer, TableHead, TableBody, TableRow, TableCell, Paper, Box, TextField, Collapse, TablePagination, Typography, InputAdornment } from '@mui/material';
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import InfoIcon from '@mui/icons-material/Info';

// ปรับขนาดของคอลัมน์ให้เหมาะสมกับข้อมูลใหม่
const CUSTOM_COLUMN_WIDTHS = {
  batch: '180px',
  material: '250px',
  materialName: '350px',
  weight: '150px',
  docNo: '150px',
  lineName: '200px',
  action: '120px'
};

const ViewActionCell = ({ width, onClick, icon, backgroundColor, status }) => {
  const iconColor = "hsl(210, 100%, 60%)";

  return (
    <TableCell
      style={{
        width,
        textAlign: 'center',
        borderTop: '1px solid #e0e0e0',
        borderBottom: '1px solid #e0e0e0',
        borderLeft: '1px solid #f2f2f2',
        height: '40px',
        padding: '0px',
        borderRight: "1px solid #e0e0e0",
        cursor: 'pointer',
        transition: 'background-color 0.2s ease-in-out',
        borderTopRightRadius: "8px",
        borderBottomRightRadius: "8px",
        backgroundColor: backgroundColor
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#007BFF';
        e.currentTarget.querySelector('svg').style.color = '#fff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = backgroundColor;
        e.currentTarget.querySelector('svg').style.color = iconColor;
      }}
      onTouchStart={(e) => {
        e.currentTarget.style.backgroundColor = '#007BFF';
        e.currentTarget.querySelector('svg').style.color = '#fff';
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.backgroundColor = backgroundColor;
        e.currentTarget.querySelector('svg').style.color = iconColor;
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <VisibilityIcon style={{ color: iconColor, fontSize: '22px' }} />
      </div>
    </TableCell>
  );
};

// Component สำหรับแถว Emulsion
const EmulsionRow = ({ emulsionItem, index }) => {
  const rowBackgroundColor = index % 2 === 0 ? '#fafafa' : '#ffffff';

  return (
    <TableRow 
      sx={{
        backgroundColor: rowBackgroundColor,
        '&:hover': { backgroundColor: '#e3f2fd' }
      }}
    >
      <TableCell align="center" sx={{ fontSize: '13px', padding: '8px' }}>
        {emulsionItem.Batch_Emulsion || '-'}
      </TableCell>
      <TableCell align="center" sx={{ fontSize: '13px', padding: '8px' }}>
        {emulsionItem.mat || '-'}
      </TableCell>
      <TableCell align="center" sx={{ fontSize: '13px', padding: '8px' }}>
        {emulsionItem.mat_name_Emulsion || '-'}
      </TableCell>
      <TableCell align="center" sx={{ fontSize: '13px', padding: '8px' }}>
        {emulsionItem.emu_weight ? `${emulsionItem.emu_weight} kg` : '-'}
      </TableCell>
      <TableCell align="center" sx={{ fontSize: '13px', padding: '8px' }}>
        {emulsionItem.emu_withdraw_date 
          ? new Date(emulsionItem.emu_withdraw_date).toLocaleString('th-TH', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })
          : '-'
        }
      </TableCell>
    </TableRow>
  );
};

// Component สำหรับแถว MixToPack
const MixToPackRow = ({ mixToPackItem, index, openMixToPackId, setOpenMixToPackId, API_URL }) => {
  const rowBackgroundColor = index % 2 === 0 ? '#f9f9f9' : '#ffffff';
  const isOpen = openMixToPackId === mixToPackItem.mixtp_id;
  const [emulsionData, setEmulsionData] = useState([]);
  const [isLoadingEmulsion, setIsLoadingEmulsion] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

  const fetchEmulsionData = async () => {
    const searchBatch = mixToPackItem.Batch_MixToPack;
    const searchMaterial = mixToPackItem.mat_MixToPack;
    
    console.log('═══════════════════════════════════════════════════');
    console.log('🔍 เริ่มค้นหาข้อมูล Emulsion');
    console.log('📦 MixToPack Item:', mixToPackItem);
    console.log('🔎 Search Criteria:');
    console.log('   - Batch:', searchBatch);
    console.log('   - Material:', searchMaterial);
    console.log('═══════════════════════════════════════════════════');
    
    if (!searchBatch) {
      console.log('⚠️ Batch_MixToPack is missing');
      setDebugInfo({ error: 'ไม่มี Batch_MixToPack' });
      return;
    }
    
    setIsLoadingEmulsion(true);
    try {
      const url = `${API_URL}/api/prep/getRMForProdEmuMixedList`;
      console.log('📡 Calling Emulsion API:', url);
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ API Response Status:', response.status);
        console.log('📊 Full API Response:', result);
        
        if (result.success && result.data) {
          console.log('📋 Total Records:', result.data.length);
          
          if (result.data.length > 0) {
            console.log('🔍 Sample Record Structure:', result.data[0]);
            console.log('Available Fields:', Object.keys(result.data[0]));
          }
          
          console.log('🔎 กำลังค้นหาด้วยวิธีต่างๆ...');
          
          const method1 = result.data.find(item => item.Batch_RMForProd === searchBatch);
          console.log(`   Method 1 (Batch_RMForProd === "${searchBatch}"):`, method1 ? '✅ Found' : '❌ Not Found');
          
          const method2 = result.data.find(item => item.mat_RMForProd === searchMaterial);
          console.log(`   Method 2 (mat_RMForProd === "${searchMaterial}"):`, method2 ? '✅ Found' : '❌ Not Found');
          
          const method3 = result.data.find(item => item.Batch === searchBatch);
          console.log(`   Method 3 (Batch === "${searchBatch}"):`, method3 ? '✅ Found' : '❌ Not Found');
          
          const method4 = result.data.find(item => item.batch === searchBatch);
          console.log(`   Method 4 (batch === "${searchBatch}"):`, method4 ? '✅ Found' : '❌ Not Found');
          
          const filteredData = method1 || method2 || method3 || method4;
          
          console.log('🎯 Final Filtered Data:', filteredData);
          
          if (filteredData && filteredData.emulsion) {
            setEmulsionData(filteredData.emulsion);
            console.log('✅ Emulsion data set successfully:', filteredData.emulsion);
            setDebugInfo({
              success: true,
              method: method1 ? 'Batch_RMForProd' : method2 ? 'mat_RMForProd' : method3 ? 'Batch' : 'batch',
              recordsFound: filteredData.emulsion.length
            });
          } else {
            setEmulsionData([]);
            console.log('⚠️ No emulsion data found');
            
            const availableBatches = result.data.map(item => ({
              Batch_RMForProd: item.Batch_RMForProd,
              mat_RMForProd: item.mat_RMForProd,
              hasEmulsion: !!item.emulsion,
              emulsionCount: item.emulsion ? item.emulsion.length : 0
            }));
            
            console.log('📋 Available Batches in API:', availableBatches);
            
            setDebugInfo({
              success: false,
              searchBatch,
              searchMaterial,
              totalRecords: result.data.length,
              availableBatches
            });
          }
        } else {
          console.log('⚠️ API returned success: false or no data');
          setEmulsionData([]);
          setDebugInfo({ error: 'API ส่งคืน success: false หรือไม่มีข้อมูล' });
        }
      } else {
        console.error('❌ API Response not OK:', response.status);
        setEmulsionData([]);
        setDebugInfo({ error: `API Error: ${response.status}` });
      }
    } catch (error) {
      console.error('❌ Error fetching Emulsion data:', error);
      setEmulsionData([]);
      setDebugInfo({ error: error.message });
    } finally {
      setIsLoadingEmulsion(false);
      console.log('═══════════════════════════════════════════════════');
    }
  };

  useEffect(() => {
    if (isOpen) {
      console.log('👁️ Detail opened for Batch:', mixToPackItem.Batch_MixToPack);
      fetchEmulsionData();
    } else {
      setEmulsionData([]);
      setDebugInfo(null);
    }
  }, [isOpen]);

  return (
    <>
      <TableRow
        sx={{
          backgroundColor: rowBackgroundColor,
          '&:hover': { backgroundColor: '#f0f7ff' }
        }}
      >
        <TableCell align="center">{mixToPackItem.Batch_MixToPack || '-'}</TableCell>
        <TableCell align="center">{mixToPackItem.mat_MixToPack || '-'}</TableCell>
        <TableCell align="center">{mixToPackItem.mat_name_MixToPack || '-'}</TableCell>
        <TableCell align="center">
          {mixToPackItem.mix_weight ? `${mixToPackItem.mix_weight} kg` : '-'}
        </TableCell>
        <TableCell align="center">
          {mixToPackItem.mix_withdraw_date 
            ? new Date(mixToPackItem.mix_withdraw_date).toLocaleString('th-TH', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })
            : '-'
          }
        </TableCell>
        <TableCell 
          align="center"
          sx={{
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: '#007BFF',
              '& svg': {
                color: '#fff !important'
              }
            }
          }}
          onClick={() => {
            console.log('👁️ Eye icon clicked for mixtp_id:', mixToPackItem.mixtp_id);
            setOpenMixToPackId(isOpen ? null : mixToPackItem.mixtp_id);
          }}
        >
          <VisibilityIcon 
            sx={{ 
              color: 'hsl(210, 100%, 60%)', 
              fontSize: '20px',
              transition: 'color 0.2s ease-in-out'
            }} 
          />
        </TableCell>
      </TableRow>

      {/* แสดงเฉพาะตาราง Emulsion */}
      <TableRow>
        <TableCell colSpan={6} style={{ paddingBottom: 0, paddingTop: 0, border: 0 }}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{
              margin: 2,
              padding: 2,
              borderRadius: 2,
              backgroundColor: '#f9f9f9',
              boxShadow: '0px 1px 3px rgba(0,0,0,0.1)'
            }}>
              <Typography
                variant="subtitle1"
                gutterBottom
                sx={{
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#0066cc',
                  marginBottom: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                🧪 รายละเอียด Emulsion ของ Batch: {mixToPackItem.Batch_MixToPack}
              </Typography>

              {debugInfo && !debugInfo.success && (
                <Box sx={{
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '6px',
                  padding: '10px',
                  marginBottom: '10px',
                  fontSize: '12px'
                }}>
                  <Typography sx={{ fontWeight: 'bold', marginBottom: 1, color: '#856404' }}>
                    🔍 Debug Information:
                  </Typography>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </Box>
              )}

              {isLoadingEmulsion ? (
                <Box sx={{ textAlign: 'center', padding: '20px' }}>
                  <Typography sx={{ fontSize: '13px', color: '#787878' }}>
                    กำลังโหลดข้อมูล Emulsion...
                  </Typography>
                </Box>
              ) : emulsionData.length > 0 ? (
                <Table size="small" sx={{
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  border: '1px solid #ccc'
                }}>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                      <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '13px', padding: '8px' }}>Batch Emulsion</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '13px', padding: '8px' }}>Material</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '13px', padding: '8px' }}>รายชื่อวัตถุดิบ</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '13px', padding: '8px' }}>น้ำหนัก</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '13px', padding: '8px' }}>วันที่เบิก</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {emulsionData.map((emuItem, idx) => (
                      <EmulsionRow
                        key={`emulsion-${emuItem.emu_id || idx}`}
                        emulsionItem={emuItem}
                        index={idx}
                      />
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Box sx={{ 
                  textAlign: 'center', 
                  padding: '15px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '6px'
                }}>
                  <Typography sx={{ fontSize: '13px', color: '#787878', fontStyle: 'italic' }}>
                    ไม่มีข้อมูล Emulsion สำหรับ Batch: {mixToPackItem.Batch_MixToPack}
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: '#999', marginTop: 1 }}>
                    (ตรวจสอบ Console สำหรับข้อมูลเพิ่มเติม - กด F12)
                  </Typography>
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const Row = ({
  row,
  openRowId,
  setOpenRowId,
  index,
  API_URL
}) => {
  const backgroundColor = index % 2 === 0 ? '#ffffff' : "hsl(210, 100.00%, 88%)";
  const isOpen = openRowId === row.rmfp_id;
  const [openMixToPackId, setOpenMixToPackId] = useState(null);

  const mainRowData = {
    batch: row.Batch_RMForProd || '-',
    material: row.mat_RMForProd || '-',
    materialName: row.mat_name_RMForProd || '-',
    weight: row.weight ? `${row.weight} kg` : '-', 
    docNo: row.production || '-',
    lineName: row.rmfp_line_name || '-'
  };

  return (
    <>
      <TableRow>
        <TableCell style={{ height: "7px", padding: "0px", border: "0px solid" }}></TableCell>
      </TableRow>
      <TableRow>
        {Object.values(mainRowData).map((value, idx) => (
          <TableCell
            key={idx}
            align="center"
            style={{
              width: Object.values(CUSTOM_COLUMN_WIDTHS)[idx],
              borderTopLeftRadius: idx === 0 ? "8px" : "0",
              borderBottomLeftRadius: idx === 0 ? "8px" : "0",
              borderTop: '1px solid #e0e0e0',
              borderBottom: '1px solid #e0e0e0',
              borderLeft: idx === 0 ? "1px solid #e0e0e0" : "1px solid #f2f2f2",
              whiteSpace: 'normal',
              wordWrap: 'break-word',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: '14px',
              height: '40px',
              lineHeight: '1.5',
              padding: '0px 15px',
              color: "#787878",
              backgroundColor: backgroundColor
            }}
          >
            {value}
          </TableCell>
        ))}

        <ViewActionCell
          width={CUSTOM_COLUMN_WIDTHS.action}
          onClick={(e) => {
            e.stopPropagation();
            setOpenRowId(isOpen ? null : row.rmfp_id);
            if (isOpen) {
              setOpenMixToPackId(null);
            }
          }}
          backgroundColor={backgroundColor}
          status={null}
        />
      </TableRow>

      <TableRow>
        <TableCell colSpan={7} style={{ paddingBottom: 0, paddingTop: 0, border: 0 }}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{
              margin: 1,
              backgroundColor: "#f9f9f9",
              padding: 2,
              borderRadius: 2,
              boxShadow: '0px 2px 4px rgba(0,0,0,0.1)'
            }}>
              <Typography
                variant="h6"
                gutterBottom
                component="div"
                sx={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#333',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <InfoIcon color="primary" />
                รายละเอียด MixToPack ของ Batch: {row.Batch_RMForProd}
              </Typography>

              <Table size="small" sx={{
                backgroundColor: 'white',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #e0e0e0'
              }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '14px' }}>Batch</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '14px' }}>Material</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '14px' }}>รายชื่อวัตถุดิบ</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '14px' }}>น้ำหนัก</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '14px' }}>วันที่เบิก</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '14px' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {row.mixToPack && row.mixToPack.length > 0 ? (
                    row.mixToPack.map((mixToPackItem, idx) => (
                      <MixToPackRow
                        key={`${mixToPackItem.mixtp_id}-${idx}`}
                        mixToPackItem={mixToPackItem}
                        index={idx}
                        openMixToPackId={openMixToPackId}
                        setOpenMixToPackId={setOpenMixToPackId}
                        API_URL={API_URL}
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ 
                        padding: "20px", 
                        fontSize: "14px", 
                        color: "#787878",
                        fontStyle: 'italic'
                      }}>
                        ไม่มีข้อมูล MixToPack
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell style={{ padding: "0px", border: "0px solid" }}></TableCell>
      </TableRow>
    </>
  );
};

const TableRMForProd = ({ data, API_URL }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRows, setFilteredRows] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [openRowId, setOpenRowId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    if (data && data.length > 0) {
      setFilteredRows(data);
    } else {
      setFilteredRows([]);
    }
    setIsLoading(false);
  }, [data]);

  useEffect(() => {
    const filterData = () => {
      let filtered = [...data];

      if (searchTerm) {
        filtered = filtered.filter((item) => {
          const mainDataMatch = Object.values(item).some(value =>
            value && typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase())
          );

          const mixToPackMatch = item.mixToPack && item.mixToPack.some(mixToPackItem =>
            Object.values(mixToPackItem).some(value =>
              value && typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase())
            )
          );

          return mainDataMatch || mixToPackMatch;
        });
      }

      setFilteredRows(filtered);
    };

    filterData();
  }, [searchTerm, data]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  };

  const mainColumns = [
    "Batch", "Material", "รายชื่อวัตถุดิบ", "น้ำหนักวัตถุดิบ", "DOC_NO", "Line Name", "Action"
  ];

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden', boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.2)' }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' }, 
        alignItems: 'center', 
        gap: 1, 
        paddingX: 2, 
        height: { xs: 'auto', sm: '60px' }, 
        margin: '5px 5px' 
      }}>
        <TextField
          variant="outlined"
          fullWidth
          placeholder="พิมพ์เพื่อค้นหา..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            sx: { height: "40px" },
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              height: "40px",
              fontSize: "14px",
              borderRadius: "8px",
              color: "#787878",
            },
            "& input": {
              padding: "8px",
            },
          }}
        />
      </Box>
      
      <TableContainer
        style={{ padding: '0px 20px' }}
        sx={{
          height: 'calc(68vh)',
          overflowY: 'auto',
          whiteSpace: 'nowrap',
          '@media (max-width: 1400px)': {
            overflowX: 'scroll',
            minWidth: "1400px"
          }
        }}
      >
        <Table
          stickyHeader
          style={{ tableLayout: 'auto' }}
          sx={{ minWidth: '1400px', width: '100%' }}
        >
          <TableHead style={{ marginBottom: "10px" }}>
            <TableRow sx={{ height: '40px' }}>
              {mainColumns.slice(0, 6).map((header, index) => (
                <TableCell
                  key={index}
                  align="center"
                  style={{
                    backgroundColor: "hsl(210, 100%, 60%)",
                    borderTop: "1px solid #e0e0e0",
                    borderBottom: "1px solid #e0e0e0",
                    borderRight: "1px solid #f2f2f2",
                    borderLeft: index === 0 ? "1px solid #e0e0e0" : "1px solid #f2f2f2",
                    borderTopLeftRadius: index === 0 ? "8px" : "0",
                    borderBottomLeftRadius: index === 0 ? "8px" : "0",
                    fontSize: '16px',
                    color: '#ffffff',
                    padding: '10px',
                    width: Object.values(CUSTOM_COLUMN_WIDTHS)[index]
                  }}
                >
                  {header}
                </TableCell>
              ))}

              <TableCell
                align="center"
                style={{
                  backgroundColor: "hsl(210, 100%, 60%)",
                  borderTopRightRadius: "8px",
                  borderBottomRightRadius: "8px",
                  borderTop: "1px solid #e0e0e0",
                  borderBottom: "1px solid #e0e0e0",
                  borderRight: "1px solid #e0e0e0",
                  fontSize: '16px',
                  color: '#ffffff',
                  padding: '10px',
                  width: CUSTOM_COLUMN_WIDTHS.action
                }}
              >
                Action
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody sx={{ '& > tr': { marginBottom: '8px' } }}>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ padding: "20px", fontSize: "16px", color: "#787878" }}>
                  กำลังโหลดข้อมูล...
                </TableCell>
              </TableRow>
            ) : filteredRows.length > 0 ? (
              filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <Row
                  key={row.rmfp_id || index}
                  row={row}
                  openRowId={openRowId}
                  index={index}
                  setOpenRowId={setOpenRowId}
                  API_URL={API_URL}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ padding: "20px", fontSize: "16px", color: "#787878" }}>
                  ไม่มีรายการข้อมูลในขณะนี้
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <TablePagination
        sx={{
          "& .MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows, .MuiTablePagination-toolbar": {
            fontSize: '12px',
            color: "#787878",
            padding: "0px",
          }
        }}
        rowsPerPageOptions={[20, 50, 100]}
        component="div"
        count={filteredRows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};

export default TableRMForProd;
