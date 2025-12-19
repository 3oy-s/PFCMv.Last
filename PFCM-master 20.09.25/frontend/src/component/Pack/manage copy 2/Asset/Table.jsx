import React, { useState, useEffect, useRef } from 'react';
import { Table, TableContainer, TableHead, TableBody, TableRow, TableCell, Paper, Box, TextField, TablePagination, IconButton, Chip } from '@mui/material';
import { LiaShoppingCartSolid } from 'react-icons/lia';
import { InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/EditOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { FaRegCircle, FaRegCheckCircle, FaFileExcel, FaWeight } from "react-icons/fa";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';

const CUSTOM_COLUMN_WIDTHS = {
  delayTime: '180px',
  weight: '120px',
  prepDateTime: '200px',
  confirm: '90px',
  cart: '70px',
  complete: '70px',
  edit: '70px',
  delete: '70px'
};

const formatDateOnly = (dateTime) => {
  if (!dateTime || dateTime === '-') return '';
  return dateTime.split(' ')[0];
};

const calculateMinutesDifference = (startDate, endDate) => {
  if (!startDate || startDate === '-' || !endDate || endDate === '-') return null;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  
  const diffInMinutes = (end - start) / (1000 * 60);
  return diffInMinutes >= 0 ? diffInMinutes : null;
};

const formatMinutesToTime = (minutes) => {
  if (minutes === null || minutes === undefined) return '-';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  
  let timeString = '';
  if (hours > 0) timeString += `${hours} ชม.`;
  if (mins > 0) {
    if (timeString) timeString += ' ';
    timeString += `${mins} นาที`;
  }
  
  return timeString || '0 นาที';
};

const calculateDBS1 = (row) => {
  const minutes = calculateMinutesDifference(row.rmit_date, row.come_cold_date);
  return formatMinutesToTime(minutes);
};

const calculateDBS2 = (row) => {
  let totalMinutes = 0;
  let hasData = false;
  
  const cold1 = calculateMinutesDifference(row.come_cold_date, row.out_cold_date);
  if (cold1 !== null) {
    totalMinutes += cold1;
    hasData = true;
  }
  
  const cold2 = calculateMinutesDifference(row.come_cold_date_two, row.out_cold_date_two);
  if (cold2 !== null) {
    totalMinutes += cold2;
    hasData = true;
  }
  
  const cold3 = calculateMinutesDifference(row.come_cold_date_three, row.out_cold_date_three);
  if (cold3 !== null) {
    totalMinutes += cold3;
    hasData = true;
  }
  
  return hasData ? formatMinutesToTime(totalMinutes) : '-';
};

const calculateDBS3 = (row) => {
  let minutes = null;
  
  if (row.out_cold_date_three && row.out_cold_date_three !== '-') {
    minutes = calculateMinutesDifference(row.out_cold_date_three, row.sc_pack_date);
  }
  else if (row.out_cold_date_two && row.out_cold_date_two !== '-') {
    minutes = calculateMinutesDifference(row.out_cold_date_two, row.sc_pack_date);
  }
  else if (row.out_cold_date && row.out_cold_date !== '-') {
    minutes = calculateMinutesDifference(row.out_cold_date, row.sc_pack_date);
  }
  
  return formatMinutesToTime(minutes);
};

const calculateDBS4 = (row) => {
  const dbs1Minutes = calculateMinutesDifference(row.rmit_date, row.come_cold_date);
  
  let dbs3Minutes = null;
  if (row.out_cold_date_three && row.out_cold_date_three !== '-') {
    dbs3Minutes = calculateMinutesDifference(row.out_cold_date_three, row.sc_pack_date);
  } else if (row.out_cold_date_two && row.out_cold_date_two !== '-') {
    dbs3Minutes = calculateMinutesDifference(row.out_cold_date_two, row.sc_pack_date);
  } else if (row.out_cold_date && row.out_cold_date !== '-') {
    dbs3Minutes = calculateMinutesDifference(row.out_cold_date, row.sc_pack_date);
  }
  
  if (dbs1Minutes !== null && dbs3Minutes !== null) {
    return formatMinutesToTime(dbs1Minutes + dbs3Minutes);
  }
  
  const directMinutes = calculateMinutesDifference(row.rmit_date, row.sc_pack_date);
  return formatMinutesToTime(directMinutes);
};

const formatTime = (minutes) => {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = Math.floor(minutes % 60);

  let timeString = '';
  if (days > 0) timeString += `${days} วัน`;
  if (hours > 0) timeString += ` ${hours} ชม.`;
  if (mins > 0) timeString += ` ${mins} นาที`;
  return timeString.trim();
};

const calculateTimeDifference = (dateString) => {
  if (!dateString || dateString === '-') return 0;

  const effectiveDate = new Date(dateString);
  const currentDate = new Date();

  const diffInMinutes = (currentDate - effectiveDate) / (1000 * 60);
  return diffInMinutes > 0 ? diffInMinutes : 0;
};

const parseTimeValue = (timeStr) => {
  if (!timeStr || timeStr === '-') return null;

  const timeParts = timeStr.split('.');
  const hours = parseInt(timeParts[0], 10);
  const minutes = timeParts.length > 1 ? parseInt(timeParts[1], 10) : 0;

  return hours * 60 + minutes;
};

const getLatestColdRoomExitDate = (item) => {
  if (item.out_cold_date_three && item.out_cold_date_three !== '-') {
    return item.out_cold_date_three;
  } else if (item.out_cold_date_two && item.out_cold_date_two !== '-') {
    return item.out_cold_date_two;
  } else if (item.out_cold_date && item.out_cold_date !== '-') {
    return item.out_cold_date;
  }
  return '-';
};

const getItemStatus = (item) => {
  const latestColdRoomExitDate = getLatestColdRoomExitDate(item);

  let referenceDate = null;
  let remainingTimeValue = null;
  let standardTimeValue = null;
  const defaultStatus = {
    textColor: "#787878",
    statusMessage: "-",
    borderColor: "#969696",
    hideDelayTime: true,
    percentage: 0,
    timeRemaining: 0
  };

  if (!item) return defaultStatus;

  if ((latestColdRoomExitDate !== '-') &&
    (!item.remaining_rework_time || item.remaining_rework_time === '-')) {
    referenceDate = latestColdRoomExitDate;
    remainingTimeValue = parseTimeValue(item.remaining_ctp_time);
    standardTimeValue = parseTimeValue(item.standard_ctp_time);
  }
  else if ((latestColdRoomExitDate === '-') &&
    (!item.remaining_rework_time || item.remaining_rework_time === '-')) {
    referenceDate = item.rmit_date;
    remainingTimeValue = parseTimeValue(item.remaining_ptp_time);
    standardTimeValue = parseTimeValue(item.standard_ptp_time);
  }
  else if (item.remaining_rework_time && item.remaining_rework_time !== '-') {
    referenceDate = item.qc_date;
    remainingTimeValue = parseTimeValue(item.remaining_rework_time);
    standardTimeValue = parseTimeValue(item.standard_rework_time);
  }
  else if ((latestColdRoomExitDate !== '-') &&
    item.remaining_rework_time && item.remaining_rework_time !== '-') {
    referenceDate = latestColdRoomExitDate;
    remainingTimeValue = parseTimeValue(item.remaining_rework_time);
    standardTimeValue = parseTimeValue(item.standard_rework_time);
  }

  if (!referenceDate || (!remainingTimeValue && !standardTimeValue)) {
    return defaultStatus;
  }

  const elapsedMinutes = calculateTimeDifference(referenceDate);
  let timeRemaining;
  if (remainingTimeValue !== null) {
    timeRemaining = remainingTimeValue - elapsedMinutes;
  } else if (standardTimeValue !== null) {
    timeRemaining = standardTimeValue - elapsedMinutes;
  } else {
    timeRemaining = 0;
  }

  let percentage = 0;
  if (standardTimeValue) {
    percentage = (elapsedMinutes / standardTimeValue) * 100;
  }

  let statusMessage;
  if (timeRemaining > 0) {
    statusMessage = `เหลืออีก ${formatTime(timeRemaining)}`;
  } else {
    statusMessage = `เลยกำหนด ${formatTime(Math.abs(timeRemaining))}`;
  }

  let textColor, borderColor;
  if (timeRemaining < 0) {
    textColor = "#FF0000";
    borderColor = "#FF8175";
  } else if (percentage >= 80) {
    textColor = "#FFA500";
    borderColor = "#FFF398";
  } else {
    textColor = "#008000";
    borderColor = "#80FF75";
  }

  let formattedDelayTime = null;

  const isNegative = timeRemaining < 0;
  const absoluteTimeRemaining = Math.abs(timeRemaining);

  const hours = Math.floor(absoluteTimeRemaining / 60);
  const minutes = Math.floor(absoluteTimeRemaining % 60);

  const sign = isNegative ? '-' : '';
  formattedDelayTime = `${sign}${hours}.${minutes.toString().padStart(2, '0')}`;

  return {
    textColor,
    statusMessage,
    borderColor,
    hideDelayTime: false,
    percentage,
    timeRemaining,
    formattedDelayTime
  };
};

// SearchableDropdown Component with improved styling
const SearchableDropdown = ({ label, options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange(option);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    onChange('');
    setSearchTerm('');
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '200px' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          border: value ? '2px solid #2196F3' : '1px solid #e0e0e0',
          borderRadius: '12px',
          cursor: 'pointer',
          backgroundColor: '#fff',
          height: '42px',
          fontSize: '14px',
          color: value ? '#2196F3' : '#999',
          transition: 'all 0.3s ease',
          boxShadow: isOpen ? '0 4px 12px rgba(33, 150, 243, 0.15)' : 'none'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: value ? '500' : '400' }}>
          {value || placeholder}
        </span>
        <KeyboardArrowDownIcon
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
            color: value ? '#2196F3' : '#666'
          }}
        />
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '48px',
            left: 0,
            right: 0,
            backgroundColor: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            zIndex: 1000,
            maxHeight: '320px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideDown 0.2s ease'
          }}
        >
          <div style={{ padding: '10px' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="ค้นหา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ fontSize: '18px', color: '#999' }} />
                  </InputAdornment>
                ),
                sx: { height: '38px', fontSize: '13px', borderRadius: '8px' }
              }}
            />
          </div>

          <div style={{ overflowY: 'auto', maxHeight: '270px' }}>
            {value && (
              <div
                onClick={handleClear}
                style={{
                  padding: '12px 14px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#ff4444',
                  borderBottom: '1px solid #f0f0f0',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff3f3'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <ClearIcon style={{ fontSize: '16px' }} />
                <span>ล้างตัวกรอง</span>
              </div>
            )}

            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={index}
                  onClick={() => handleSelect(option)}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#333',
                    backgroundColor: value === option ? '#E3F2FD' : 'transparent',
                    borderBottom: index < filteredOptions.length - 1 ? '1px solid #f0f0f0' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (value !== option) e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    if (value !== option) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {option}
                </div>
              ))
            ) : (
              <div style={{ padding: '20px 14px', fontSize: '13px', color: '#999', textAlign: 'center' }}>
                ไม่พบข้อมูล
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Row = ({
  row,
  columnWidths,
  handleOpenModal,
  handleRowClick,
  handleOpenEditModal,
  handleOpenDeleteModal,
  handleOpenEditLineModal,
  handleOpenSuccess,
  handleConfirmRow,
  selectedColor,
  openRowId,
  setOpenRowId,
  index,
  displayColumns
}) => {
  const { borderColor, statusMessage, hideDelayTime, percentage, formattedDelayTime } = getItemStatus(row);
  const backgroundColor = index % 2 === 0 ? '#ffffff' : '#F0F8FF';

  const displayRow = {};
  displayColumns.forEach(col => {
    if (col === 'tro_id') {
      displayRow[col] = row.tro_id;
    } else if (col === 'dbs1') {
      displayRow[col] = calculateDBS1(row);
    } else if (col === 'dbs2') {
      displayRow[col] = calculateDBS2(row);
    } else if (col === 'dbs3') {
      displayRow[col] = calculateDBS3(row);
    } else if (col === 'dbs4') {
      displayRow[col] = calculateDBS4(row);
    } else {
      displayRow[col] = row[col] ?? '-';
    }
  });

  const colorMatch =
    (selectedColor === 'green' && borderColor === '#80FF75') ||
    (selectedColor === 'yellow' && borderColor === '#FFF398') ||
    (selectedColor === 'red' && borderColor === '#FF8175') ||
    (selectedColor === 'gray' && borderColor === '#969696');

  if (selectedColor && !colorMatch) return null;

  const isOpen = openRowId === row.rmfp_id;
  const isConfirmed = row.sc_pack_date && row.sc_pack_date !== '-';

  const [weight, setWeight] = useState(row.weight || '');
  const [prepDateTime, setPrepDateTime] = useState(row.sc_pack_date || '');
  const [errors, setErrors] = useState({ weight: '', prepDateTime: '' });

  const validateInputs = () => {
    const newErrors = { weight: '', prepDateTime: '' };
    let isValid = true;

    if (!weight || parseFloat(weight) <= 0) {
      newErrors.weight = 'น้ำหนักต้องมากกว่า 0';
      isValid = false;
    }

    if (!prepDateTime) {
      newErrors.prepDateTime = 'กรุณาระบุเวลา';
      isValid = false;
    } else {
      const selectedDate = new Date(prepDateTime);
      const now = new Date();
      if (selectedDate > now) {
        newErrors.prepDateTime = 'เวลาต้องไม่เป็นอดีต';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleConfirm = () => {
    if (validateInputs()) {
      handleConfirmRow({
        mapping_id: row.mapping_id,
        weight: parseFloat(weight),
        sc_pack_date: prepDateTime
      });
    }
  };

  return (
    <>
      <TableRow>
        <TableCell style={{ height: "7px", padding: "0px", border: "0px solid" }}></TableCell>
      </TableRow>
      <TableRow 
        onClick={() => {
          setOpenRowId(isOpen ? null : row.rmfp_id);
          handleRowClick(row.rmfp_id);
        }}
        style={{
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          const cells = e.currentTarget.querySelectorAll('td');
          cells.forEach(cell => {
            cell.style.backgroundColor = index % 2 === 0 ? '#F5F9FF' : '#E8F4FF';
          });
        }}
        onMouseLeave={(e) => {
          const cells = e.currentTarget.querySelectorAll('td');
          cells.forEach(cell => {
            cell.style.backgroundColor = backgroundColor;
          });
        }}
      >
        {Object.entries(displayRow).map(([key, value], idx) => (
          <TableCell
            key={idx}
            align="center"
            style={{
              width: columnWidths[idx],
              borderLeft: "1px solid #E3F2FD",
              borderTop: '1px solid #E3F2FD',
              borderBottom: '1px solid #E3F2FD',
              whiteSpace: 'normal',
              wordWrap: 'break-word',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: '14px',
              height: '48px',
              lineHeight: '1.5',
              padding: '0px 12px',
              color: "#353535ff",
              backgroundColor: backgroundColor,
              transition: 'background-color 0.2s ease'
            }}
          >
            {value || '-'}
          </TableCell>
        ))}
      </TableRow>
      <TableRow>
        <TableCell style={{ padding: "0px", border: "0px solid" }}></TableCell>
      </TableRow>
    </>
  );
};

const TableMainPrep = ({
  handleOpenModal,
  data,
  handleRowClick,
  handleOpenEditModal,
  handleOpenDeleteModal,
  handleOpenEditLineModal,
  handleOpenSuccess,
  onConfirmRow
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRows, setFilteredRows] = useState(data);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [selectedColor, setSelectedColor] = useState('');
  const [openRowId, setOpenRowId] = useState(null);
  const [selectedLineName, setSelectedLineName] = useState('');
  const [selectedDocNo, setSelectedDocNo] = useState('');
  const [selectedSCPackDate, setselectedSCPackDate] = useState('');
  
  const displayColumns = ['production', 'mat_name', 'batch_after', 'weight_RM', 'rmit_date', 'come_cold_date', 'out_cold_date', 'come_cold_date_two', 'out_cold_date_two', 'come_cold_date_three', 'out_cold_date_three', 'sc_pack_date', 'dbs1', 'dbs2', 'dbs3', 'dbs4'];
  
  const uniqueLineNames = [...new Set(data.map(row => row.line_name).filter(Boolean))].sort();
  const uniqueDocNos = [...new Set(data.map(row => row.doc_no).filter(Boolean))].sort();
  const uniqueSCPackDate = [...new Set(
    data
      .map(row => formatDateOnly(row.sc_pack_date))
      .filter(Boolean)
  )].sort((a, b) => new Date(a) - new Date(b));

  // Calculate total weight
  const totalWeight = filteredRows.reduce((sum, row) => {
    const weight = parseFloat(row.weight_RM) || 0;
    return sum + weight;
  }, 0);

  useEffect(() => {
    let filtered = data;

    if (searchTerm) {
      filtered = filtered.filter((row) =>
        Object.values(row).some((value) =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (selectedLineName) {
      filtered = filtered.filter(row => row.line_name === selectedLineName);
    }

    if (selectedDocNo) {
      filtered = filtered.filter(row => row.doc_no === selectedDocNo);
    }
    
    if (selectedSCPackDate) {
      filtered = filtered.filter(
        row => formatDateOnly(row.sc_pack_date) === selectedSCPackDate
      );
    }

    setFilteredRows(filtered);
    setPage(0);
  }, [searchTerm, data, selectedLineName, selectedDocNo, selectedSCPackDate]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  };

  const handleFilterChange = (color) => {
    setSelectedColor(color === selectedColor ? '' : color);
  };

  // Export to Excel function
  const exportToExcel = () => {
    const headerNames = {
      "production": "แผนการผลิต",
      "mat_name": "รายชื่อวัตถุดิบ",
      "batch_after": "Batch",
      "rmit_date": "เวลาเตรียมเสร็จ",
      "weight_RM": "น้ำหนักวัตถุดิบ",
      "come_cold_date": "เข้าห้องเย็น1",
      "come_cold_date_two": "เข้าห้องเย็น2",
      "come_cold_date_three": "เข้าห้องเย็น3",
      "out_cold_date": "ออกห้องเย็น1",
      "out_cold_date_two": "ออกห้องเย็น2",
      "out_cold_date_three": "ออกห้องเย็น3",
      "sc_pack_date": "บรรจุเสร็จ",
      "dbs1": "DBS 1",
      "dbs2": "DBS 2",
      "dbs3": "DBS 3",
      "dbs4": "DBS 4"
    };

    // Prepare data for export
    const exportData = filteredRows.map(row => {
      const exportRow = {};
      displayColumns.forEach(col => {
        if (col === 'dbs1') {
          exportRow[headerNames[col]] = calculateDBS1(row);
        } else if (col === 'dbs2') {
          exportRow[headerNames[col]] = calculateDBS2(row);
        } else if (col === 'dbs3') {
          exportRow[headerNames[col]] = calculateDBS3(row);
        } else if (col === 'dbs4') {
          exportRow[headerNames[col]] = calculateDBS4(row);
        } else {
          exportRow[headerNames[col]] = row[col] ?? '-';
        }
      });
      return exportRow;
    });

    // Convert to CSV
    const headers = displayColumns.map(col => headerNames[col]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(header => {
          const value = row[header] || '-';
          return `"${value}"`;
        }).join(',')
      )
    ].join('\n');

    // Add BOM for UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `prep_data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalCustomWidth = Object.values(CUSTOM_COLUMN_WIDTHS).reduce((sum, width) => sum + parseInt(width), 0);
  const remainingWidth = `calc((100% - ${totalCustomWidth}px) / ${displayColumns.length})`;
  const columnWidths = Array(displayColumns.length).fill(remainingWidth);

  const headerNames = {
    "production": "แผนการผลิต",
    "mat_name": "รายชื่อวัตถุดิบ",
    "batch_after": "Batch",
    "rmit_date": "เวลาเตรียมเสร็จ",
    "weight_RM": "น้ำหนักวัตถุดิบ",
    "come_cold_date": "เข้าห้องเย็น1",
    "come_cold_date_two": "เข้าห้องเย็น2",
    "come_cold_date_three": "เข้าห้องเย็น3",
    "out_cold_date": "ออกห้องเย็น1",
    "out_cold_date_two": "ออกห้องเย็น2",
    "out_cold_date_three": "ออกห้องเย็น3",
    "sc_pack_date": "บรรจุเสร็จ",
    "dbs1": "DBS 1",
    "dbs2": "DBS 2",
    "dbs3": "DBS 3",
    "dbs4": "DBS 4"
  };

  const getColumnWidth = (header) => {
    if (header === "production") return "150px";
    if (header === "mat_name") return "200px";
    if (header === "rmit_date") return "150px";
    if (header === "tro_id") return "180px";
    if (["weight_RM"].includes(header)) return "90px";
    if (header === "batch_after") return "120px";
    if (header === "mat") return "150px";
    if (header === "out_cold_date") return "150px";
    if (header === "out_cold_date_two") return "150px";
    if (header === "out_cold_date_three") return "150px";
    if (header === "come_cold_date") return "150px";
    if (header === "come_cold_date_two") return "150px";
    if (header === "come_cold_date_three") return "150px";
    if (header === "sc_pack_date") return "150px";
    if (["dbs1", "dbs2", "dbs3", "dbs4"].includes(header)) return "153px";
    return "150px";
  };

  const handleDeleteItemWithDelay = (row) => {
    const rowWithDelay = { ...row };
    handleOpenDeleteModal(rowWithDelay);
  };

  return (
    <Paper sx={{ 
      width: '100%', 
      overflow: 'hidden', 
      boxShadow: '0px 4px 20px rgba(33, 150, 243, 0.1)',
      borderRadius: '16px',
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)'
    }}>
      <style>
        {`
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }
        `}
      </style>

      {/* Header Section with improved design */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
        padding: '20px 24px',
        borderRadius: '16px 16px 0 0'
      }}>
        {/* Search and Actions Row */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' }, 
          alignItems: 'center', 
          gap: 2,
          marginBottom: 2
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
                  <SearchIcon style={{ color: '#2196F3' }} />
                </InputAdornment>
              ),
              sx: { 
                height: "44px",
                backgroundColor: '#fff',
                borderRadius: '12px',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(33, 150, 243, 0.15)'
                }
              },
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                height: "44px",
                fontSize: "14px",
                borderRadius: "12px",
                color: "#546E7A",
                '& fieldset': {
                  borderColor: 'transparent',
                },
                '&:hover fieldset': {
                  borderColor: '#2196F3',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#2196F3',
                  borderWidth: '2px'
                },
              },
              "& input": {
                padding: "10px",
              },
            }}
          />
          
          {/* Export Button */}
          <IconButton
            onClick={exportToExcel}
            sx={{
              backgroundColor: '#fff',
              color: '#2196F3',
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: '#E3F2FD',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 16px rgba(33, 150, 243, 0.25)'
              }
            }}
          >
            <FileDownloadIcon />
          </IconButton>
        </Box>

        {/* Filters and Weight Summary Row */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterListIcon sx={{ color: '#fff', fontSize: '20px' }} />
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>ตัวกรอง:</span>
          </Box>
          
          <SearchableDropdown
            label="Line Name"
            options={uniqueLineNames}
            value={selectedLineName}
            onChange={setSelectedLineName}
            placeholder="เลือก Line Name"
          />
          <SearchableDropdown
            label="Doc No"
            options={uniqueDocNos}
            value={selectedDocNo}
            onChange={setSelectedDocNo}
            placeholder="เลือก Doc No"
          />
          <SearchableDropdown
            label="sc_pack_date"
            options={uniqueSCPackDate}
            value={selectedSCPackDate}
            onChange={setselectedSCPackDate}
            placeholder="เลือกวันที่บรรจุเสร็จ"
          />

          {/* Weight Summary Chip */}
          <Chip
            icon={<FaWeight style={{ fontSize: '16px' }} />}
            label={`น้ำหนักรวม: ${totalWeight.toFixed(2)} กก.`}
            sx={{
              backgroundColor: '#fff',
              color: '#2196F3',
              fontWeight: '600',
              fontSize: '14px',
              height: '42px',
              borderRadius: '12px',
              padding: '0 8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              animation: 'pulse 2s infinite',
              '& .MuiChip-icon': {
                color: '#2196F3'
              }
            }}
          />
        </Box>
      </Box>

      <TableContainer 
        style={{ padding: '0px 20px' }} 
        sx={{ 
          height: 'calc(68vh)', 
          overflowY: 'auto', 
          whiteSpace: 'nowrap', 
          '@media (max-width: 1200px)': { 
            overflowX: 'scroll', 
            minWidth: "200px" 
          },
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px'
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
            borderRadius: '10px'
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#2196F3',
            borderRadius: '10px',
            '&:hover': {
              background: '#1976D2'
            }
          }
        }}
      >
        <Table stickyHeader style={{ tableLayout: 'auto' }} sx={{ minWidth: '1270px', width: 'max-content' }}>
          <TableHead style={{ marginBottom: "10px" }}>
            <TableRow sx={{ height: '48px' }}>
              {displayColumns.map((header, index) => (
                <TableCell
                  key={index}
                  align="center"
                  style={{
                    backgroundColor: "#2196F3",
                    borderTop: "1px solid #1976D2",
                    borderBottom: "1px solid #1976D2",
                    borderLeft: index === 0 ? "1px solid #1976D2" : "1px solid rgba(255,255,255,0.1)",
                    borderRight: index === displayColumns.length - 1 ? "1px solid #1976D2" : "1px solid rgba(255,255,255,0.1)",
                    fontSize: '14px',
                    color: '#fff',
                    padding: '12px',
                    width: getColumnWidth(header),
                    fontWeight: '600',
                    borderTopLeftRadius: index === 0 ? '12px' : '0',
                    borderTopRightRadius: index === displayColumns.length - 1 ? '12px' : '0',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <Box style={{ fontSize: '15px', color: '#ffffff', letterSpacing: '0.3px' }}>
                    {headerNames[header] || header}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody sx={{ '& > tr': { marginBottom: '8px' } }}>
            {filteredRows.length > 0 ? (
              filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <Row
                  key={index}
                  row={row}
                  columnWidths={columnWidths}
                  handleOpenModal={handleOpenModal}
                  handleRowClick={handleRowClick}
                  handleOpenEditModal={handleOpenEditModal}
                  handleOpenEditLineModal={handleOpenEditLineModal}
                  handleOpenDeleteModal={handleDeleteItemWithDelay}
                  handleOpenSuccess={handleOpenSuccess}
                  handleConfirmRow={onConfirmRow}
                  selectedColor={selectedColor}
                  openRowId={openRowId}
                  index={index}
                  setOpenRowId={setOpenRowId}
                  displayColumns={displayColumns}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={displayColumns.length} align="center" sx={{ 
                  padding: "40px", 
                  fontSize: "16px", 
                  color: "#90A4AE",
                  fontWeight: '500'
                }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <SearchIcon sx={{ fontSize: '48px', color: '#BBDEFB' }} />
                    <span>ไม่มีรายการวัตถุดิบในขณะนี้</span>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <TablePagination
        sx={{
          borderTop: '1px solid #E3F2FD',
          backgroundColor: '#F8FBFF',
          "& .MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows, .MuiTablePagination-toolbar": {
            fontSize: '13px',
            color: "#546E7A",
            padding: "0px",
            fontWeight: '500'
          },
          "& .MuiTablePagination-select": {
            fontSize: '13px',
            color: "#2196F3",
            fontWeight: '600'
          },
          "& .MuiTablePagination-actions button": {
            color: "#2196F3",
            '&:hover': {
              backgroundColor: '#E3F2FD'
            }
          }
        }}
        rowsPerPageOptions={[100, 500, 1000]}
        component="div"
        count={filteredRows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="แถวต่อหน้า:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} จาก ${count}`}
      />
    </Paper>
  );
};

const FilterButton = ({ color, selectedColor, onClick }) => {
  const [isHovered, setHovered] = useState(false);

  const colors = {
    green: { default: "#54e032", hover: "#6eff42", selected: "#54e032" },
    yellow: { default: "#f0cb4d", hover: "#ffdf5d", selected: "#f0cb4d" },
    red: { default: "#ff4444", hover: "#ff6666", selected: "#ff4444" },
  };

  const isSelected = selectedColor === color;
  const noSelection = selectedColor == null;
  const currentColor = colors[color];

  const baseStyle = {
    border: isSelected
      ? `2px solid ${currentColor.selected}`
      : `1px solid ${isHovered ? currentColor.hover : "#e0e0e0"}`,
    padding: 6,
    borderRadius: 6,
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
    backgroundColor: isSelected
      ? "transparent"
      : isHovered
        ? currentColor.hover
        : currentColor.default,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
  };

  return (
    <div
      style={baseStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isSelected && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: currentColor.selected,
            opacity: 0.2,
            zIndex: 0,
          }}
        />
      )}

      <FaRegCircle
        style={{
          color: isSelected
            ? currentColor.selected
            : noSelection
              ? "#ffffff"
              : "#ffffff",
          fontSize: 24,
          transition: "color 0.2s ease-in-out",
          position: "relative",
          zIndex: 1,
          opacity: isSelected ? 1 : 0.9,
        }}
      />
    </div>
  );
};

export default TableMainPrep;