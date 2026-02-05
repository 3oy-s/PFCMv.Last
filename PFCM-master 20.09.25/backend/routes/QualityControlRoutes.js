module.exports = (io) => {
	const express = require("express");
	const { connectToDatabase } = require("../database/db");
	const sql = require("mssql");
	const router = express.Router();

	router.get("/qc/main/fetchRMForProd", async (req, res) => {
		try {
			const { rm_type_ids } = req.query;

			if (!rm_type_ids) {
				return res.status(400).json({ success: false, error: "RM Type IDs are required" });
			}

			const rmTypeIdsArray = rm_type_ids.split(',');
			const pool = await connectToDatabase();

			const query = `
      SELECT
        rmf.rmfp_id,
        STRING_AGG(b.batch_after, ', ') AS batch, -- ✅ รวมค่าทั้งหมดใน mapping เดียว
        rm.mat,
        rm.mat_name,
        CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,
        rmm.tro_id,
        rmm.level_eu,
        rmm.weight_RM,
        rmm.tray_count,
        rmg.rm_type_id,
        rmm.mapping_id,
        rmm.dest,
        rmm.stay_place,
        rmm.rm_status,
        MAX(htr.cooked_date) AS cooked_date -- ใช้ MAX ป้องกัน GROUP BY error
      FROM
        RMForProd rmf
      JOIN 
        TrolleyRMMapping rmm ON rmf.rmfp_id = rmm.rmfp_id        
      JOIN
        ProdRawMat pr ON rmm.tro_production_id = pr.prod_rm_id
      JOIN
        RawMat rm ON pr.mat = rm.mat
      JOIN
        Production p ON pr.prod_id = p.prod_id
      JOIN
        RawMatCookedGroup rmcg ON rm.mat = rmcg.mat
      JOIN
        RawMatGroup rmg ON rmcg.rm_group_id = rmg.rm_group_id
      LEFT JOIN 
        Batch b ON rmm.mapping_id = b.mapping_id  -- ✅ เปลี่ยน join เงื่อนไขตรงนี้
      JOIN
        History htr ON rmm.mapping_id = htr.mapping_id
      WHERE 
        (
          (rmm.dest = 'เข้าห้องเย็น' AND (rmm.rm_status = 'รอQCตรวจสอบ' OR rmm.rm_status = 'QcCheck รอแก้ไข'))
          OR 
          (rmm.dest = 'เตรียมผสม' AND (rmm.rm_status = 'รอQCตรวจสอบ' OR rmm.rm_status = 'QcCheck รอแก้ไข'))
          OR 
          (rmm.dest = 'ไปบรรจุ' AND (rmm.rm_status = 'รอQCตรวจสอบ' OR rmm.rm_status = 'QcCheck รอแก้ไข' OR rmm.rm_status = 'รอกลับมาเตรียม'))
		  OR 
		  (rmm.dest = 'ผสมเตรียม' AND (rmm.rm_status = 'รอQCตรวจสอบ' ))
		  OR 
          (rmm.dest = 'รอCheckin' AND rmm.rm_status = 'รอQCตรวจสอบ')
        )
        AND rmf.rm_group_id = rmg.rm_group_id
        AND rmg.rm_type_id IN (${rmTypeIdsArray.map(t => `'${t}'`).join(',')})
      GROUP BY
        rmf.rmfp_id,
        rm.mat,
        rm.mat_name,
        p.doc_no,
        rmm.rmm_line_name,
        rmm.tro_id,
        rmm.level_eu,
        rmm.weight_RM,
        rmm.tray_count,
        rmg.rm_type_id,
        rmm.mapping_id,
        rmm.dest,
        rmm.stay_place,
        rmm.rm_status
      ORDER BY MAX(htr.cooked_date) DESC
    `;

			const result = await pool.request().query(query);

			const formattedData = result.recordset.map(item => {
				const date = new Date(item.cooked_date);
				const year = date.getUTCFullYear();
				const month = String(date.getUTCMonth() + 1).padStart(2, '0');
				const day = String(date.getUTCDate()).padStart(2, '0');
				const hours = String(date.getUTCHours()).padStart(2, '0');
				const minutes = String(date.getUTCMinutes()).padStart(2, '0');
				item.CookedDateTime = `${year}-${month}-${day} ${hours}:${minutes}`;
				delete item.cooked_date;
				return item;
			});

			res.json({ success: true, data: formattedData });
		} catch (err) {
			console.error("SQL error", err);
			res.status(500).json({ success: false, error: err.message });
		}
	});


	router.get("/qc/fetchRMForProd", async (req, res) => {
		try {
			const { rm_type_ids } = req.query;

			if (!rm_type_ids) {
				return res.status(400).json({ success: false, error: "RM Type IDs are required" });
			}

			const rmTypeIdsArray = rm_type_ids.split(',');
			const pool = await connectToDatabase();

			const query = `
      SELECT
        rmm.mapping_id,
        rmf.rmfp_id,
        STRING_AGG(b.batch_after, ', ') AS batch_after,  -- ✅ รวมค่า batch_after ในแถวเดียว
        pc.process_name,
        rm.mat,
        rm.mat_name,
        CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,
        rmm.rmm_line_name,
        rmm.dest,
        rmm.weight_RM,
        rmm.tray_count,
        rmg.rm_type_id,
        rmm.tro_id,
        rmm.level_eu,
        rmf.rm_group_id AS rmf_rm_group_id,
        rmg.rm_group_id AS rmg_rm_group_id,
        rmm.rm_status,
        rmg.prep_to_pack,
        rmm.rework_time,
        MAX(htr.cooked_date) AS cooked_date,        -- ✅ ใช้ MAX ป้องกัน group by error
        MAX(htr.rmit_date) AS rmit_date,
        MAX(htr.withdraw_date) AS withdraw_date,
        MAX(htr.name_edit_prod_two) AS name_edit_prod_two,
        MAX(htr.name_edit_prod_three) AS name_edit_prod_three,
        MAX(htr.first_prod) AS first_prod,
        MAX(htr.two_prod) AS two_prod,
        MAX(htr.three_prod) AS three_prod,
        MAX(htr.edit_rework) AS edit_rework,
        MAX(htr.remark_rework) AS remark_rework,
        MAX(htr.remark_rework_cold) AS remark_rework_cold
      FROM
        RMForProd rmf
      JOIN 
        TrolleyRMMapping rmm ON rmf.rmfp_id = rmm.rmfp_id
      JOIN
        Process pc ON rmm.process_id = pc.process_id
      JOIN
        ProdRawMat pr ON rmm.tro_production_id = pr.prod_rm_id
      JOIN
        RawMat rm ON pr.mat = rm.mat
      JOIN
        Production p ON pr.prod_id = p.prod_id
      JOIN
        RawMatCookedGroup rmcg ON rm.mat = rmcg.mat
      JOIN
        RawMatGroup rmg ON rmcg.rm_group_id = rmg.rm_group_id
      JOIN
        History htr ON rmm.mapping_id = htr.mapping_id
      LEFT JOIN 
        Batch b ON rmm.mapping_id = b.mapping_id  -- ✅ เปลี่ยนจาก batch_id เป็น mapping_id
      WHERE 
        rmm.stay_place IN ('จุดเตรียม','หม้ออบ')
        AND rmm.dest IN ('ไปบรรจุ', 'เข้าห้องเย็น','Qc','ผสมเตรียม','รอCheckin')
        AND rmm.rm_status IN ('รอQCตรวจสอบ' ,'รอ MD')
        AND rmf.rm_group_id = rmg.rm_group_id
        AND rmg.rm_type_id IN (${rmTypeIdsArray.map(t => `'${t}'`).join(',')})
      GROUP BY
        rmm.mapping_id,
        rmf.rmfp_id,
        pc.process_name,
        rm.mat,
        rm.mat_name,
        p.doc_no,
        rmm.rmm_line_name,
        rmm.dest,
        rmm.weight_RM,
        rmm.tray_count,
        rmg.rm_type_id,
        rmm.tro_id,
        rmm.level_eu,
        rmf.rm_group_id,
        rmg.rm_group_id,
        rmm.rm_status,
        rmg.prep_to_pack,
        rmm.rework_time
      ORDER BY MAX(htr.cooked_date) DESC;
    `;

			const result = await pool.request().query(query);

			const formattedData = result.recordset.map(item => {
				// Format cooked_date
				if (item.cooked_date) {
					const cookedDate = new Date(item.cooked_date);
					const year = cookedDate.getUTCFullYear();
					const month = String(cookedDate.getUTCMonth() + 1).padStart(2, '0');
					const day = String(cookedDate.getUTCDate()).padStart(2, '0');
					const hours = String(cookedDate.getUTCHours()).padStart(2, '0');
					const minutes = String(cookedDate.getUTCMinutes()).padStart(2, '0');
					item.CookedDateTime = `${year}-${month}-${day} ${hours}:${minutes}`;
					delete item.cooked_date;
				}

				// Format rmit_date
				if (item.rmit_date) {
					const rmitDate = new Date(item.rmit_date);
					const year = rmitDate.getUTCFullYear();
					const month = String(rmitDate.getUTCMonth() + 1).padStart(2, '0');
					const day = String(rmitDate.getUTCDate()).padStart(2, '0');
					const hours = String(rmitDate.getUTCHours()).padStart(2, '0');
					const minutes = String(rmitDate.getUTCMinutes()).padStart(2, '0');
					item.rmit_date = `${year}-${month}-${day} ${hours}:${minutes}`;
				}

				return item;
			});

			res.json({ success: true, data: formattedData });
		} catch (err) {
			console.error("SQL error", err);
			res.status(500).json({ success: false, error: err.message });
		}
	});


router.post("/qc/check", async (req, res) => {
	let transaction;
	try {
		const {
			mapping_id,
			color,
			odor,
			texture,
			sq_remark,
			md,
			md_remark,
			defect,
			defect_remark,
			Defectacceptance,
			Sensoryacceptance,
			md_no,
			operator,
			rm_status_qc,
			WorkAreaCode,
			Moisture,
			Temp,
			md_time,
			tro_id,
			percent_fine,
			weight_RM,
			rmm_line_name,
			tray_count,
			dest,
			general_remark,
			prepare_mor_night
		} = req.body;

		let thaiMdDateTime = null;
		let destlast = dest;

		console.log("dest :", dest);

		if (md_time) {
			try {
				const dateObj = new Date(md_time);
				dateObj.setHours(dateObj.getHours() + 7);
				thaiMdDateTime = dateObj;
			} catch (error) {
				console.error("Error parsing md_time:", error);
				thaiMdDateTime = null;
			}
		}

		// ✅ ตรวจสอบค่าที่จำเป็น
		if (
			!mapping_id ||
			isNaN(mapping_id) ||
			color === undefined ||
			odor === undefined ||
			texture === undefined ||
			md === undefined ||
			defect === undefined ||
			!operator ||
			(md === 1 && (!md_no || !WorkAreaCode))
		) {
			return res.status(400).json({
				success: false,
				message: "กรุณากรอกข้อมูลให้ครบถ้วน",
			});
		}

		const pool = await connectToDatabase();

		// ✅ ตรวจสอบ MD
		if (Number(md) === 1) {
			const mdCheck = await pool
				.request()
				.input("md_no", sql.NVarChar, md_no)
				.query(`
				SELECT md_no
				FROM [PFCMv2].[dbo].[MetalDetectors]
				WHERE md_no = @md_no AND Status = CAST(1 AS BIT)
			`);

			if (mdCheck.recordset.length === 0) {
				return res.status(400).json({
					success: false,
					message: `ไม่พบเครื่อง Metal Detector หมายเลข ${md_no} หรือเครื่องไม่พร้อมใช้งาน`,
				});
			}
		}

		// ✅ ตรวจสอบ mapping_id
		const mappingCheck = await pool
			.request()
			.input("mapping_id", sql.Int, mapping_id)
			.query(`
			SELECT mapping_id
			FROM [PFCMv2].[dbo].[TrolleyRMMapping]
			WHERE mapping_id = @mapping_id
		`);

		if (mappingCheck.recordset.length === 0) {
			return res.status(400).json({
				success: false,
				message: `ไม่พบ mapping_id ${mapping_id} ในระบบ`,
			});
		}

		// ✅ ตั้งค่าเริ่มต้น
		let rm_status = "QcCheck";
		let qccheck = "ผ่าน";
		let defect_check = "ผ่าน";
		let md_check = "ผ่าน";

		if ([color, odor, texture].includes(0) && Sensoryacceptance !== 1) {
			rm_status = "QcCheck รอแก้ไข";
			qccheck = "ไม่ผ่าน";
			destlast = "จุดเตรียม";
			console.log("destlast sen ไม่ผ่าน :", destlast);
		}

		if (defect === 0 && Defectacceptance !== 1) {
			rm_status = "QcCheck รอแก้ไข";
			defect_check = "ไม่ผ่าน";
			destlast = "จุดเตรียม";
			console.log("destlast defect ไม่ผ่าน :", destlast);
		}

		if (md === 0) {
			if ((defect === 0 && Defectacceptance !== 1) || ([color, odor, texture].includes(0) && Sensoryacceptance !== 1)) {
				rm_status = "QcCheck รอแก้ไข";
				destlast = "จุดเตรียม";
				console.log("destlast md defect หรือ sen ไม่ผ่าน :", destlast);
			} else {
				rm_status = "QcCheck รอ MD";
				md_check = "รอผ่าน MD";
			}
		}

		// ✅ เริ่ม Transaction
		transaction = new sql.Transaction(pool);
		await transaction.begin();

		// ✅ ค้นหาเวลา rework / mix / prep_to_pack
		const timeData = await transaction
			.request()
			.input("mapping_id", sql.Int, mapping_id)
			.query(`
			SELECT 
				rmm.rework_time,
				rmm.mix_time,
				rmm.prep_to_pack_time,
				rmg.prep_to_pack
			FROM
				TrolleyRMMapping rmm
				JOIN RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
				JOIN RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
			WHERE mapping_id = @mapping_id
		`);

		let rework_time = null;
		let mix_time = null;
		let prep_to_pack_time = null;

		if (timeData.recordset.length > 0) {
			rework_time = timeData.recordset[0].rework_time;
			mix_time = timeData.recordset[0].mix_time;

			if (destlast === 'ไปบรรจุ') {
				prep_to_pack_time = timeData.recordset[0].prep_to_pack_time ?? timeData.recordset[0].prep_to_pack;
			} else {
				prep_to_pack_time = timeData.recordset[0].prep_to_pack_time;
			}
		}

		// ✅ INSERT QC
		const insertResult = await transaction
			.request()
			.input("color", sql.Bit, color ? 1 : 0)
			.input("odor", sql.Bit, odor ? 1 : 0)
			.input("texture", sql.Bit, texture ? 1 : 0)
			.input("sq_remark", sql.NVarChar, sq_remark || null)
			.input("md", sql.Bit, md ? 1 : 0)
			.input("md_remark", sql.NVarChar, md_remark || null)
			.input("defect", sql.Bit, defect ? 1 : 0)
			.input("defect_remark", sql.NVarChar, defect_remark || null)
			.input("Defectacceptance", sql.Bit, Defectacceptance ? 1 : 0)
			.input("Sensoryacceptance", sql.Bit, Sensoryacceptance ? 1 : 0)
			.input("md_no", sql.NVarChar, md_no)
			.input("WorkAreaCode", sql.NVarChar, WorkAreaCode)
			.input("qccheck", sql.NVarChar, qccheck)
			.input("md_check", sql.NVarChar, md_check)
			.input("defect_check", sql.NVarChar, defect_check)
			.input("Moisture", sql.NVarChar, Moisture || null)
			.input("Temp", sql.NVarChar, Temp || null)
			.input("md_time", sql.DateTime, thaiMdDateTime)
			.input("percent_fine", sql.NVarChar, percent_fine || null)
			.input("general_remark", sql.NVarChar, general_remark || null)
			.input("prepare_mor_night", sql.NVarChar, prepare_mor_night || null)
			.query(`
			DECLARE @InsertedTable TABLE (qc_id INT);
			INSERT INTO [PFCMv2].[dbo].[QC] 
				(color, odor, texture, sq_acceptance, sq_remark, md, md_remark, defect, defect_acceptance, defect_remark, md_no, WorkAreaCode, qccheck, mdcheck, defectcheck, Moisture, Temp, md_time, percent_fine, qc_datetime, general_remark,prepare_mor_night)
			OUTPUT INSERTED.qc_id INTO @InsertedTable
			VALUES 
				(@color, @odor, @texture, @Sensoryacceptance, @sq_remark, @md, @md_remark, @defect, @Defectacceptance, @defect_remark, @md_no, @WorkAreaCode, @qccheck, @md_check, @defect_check, @Moisture, @Temp, @md_time, @percent_fine, GETDATE(), @general_remark,@prepare_mor_night);
			SELECT qc_id FROM @InsertedTable;
		`);

		const qc_id = insertResult.recordset[0].qc_id;

		// ✅ UPDATE TrolleyRMMapping
		if (destlast === 'ไปบรรจุ') {
			await transaction
				.request()
				.input("mapping_id", sql.Int, mapping_id)
				.input("rm_status", sql.NVarChar, rm_status)
				.input("dest", sql.NVarChar, destlast)
				.input("qc_id", sql.Int, qc_id)
				.input("prep_to_pack_time", sql.Int, prep_to_pack_time)
				.query(`
				UPDATE [PFCMv2].[dbo].[TrolleyRMMapping]
				SET rm_status = @rm_status, qc_id = @qc_id, prep_to_pack_time = @prep_to_pack_time , dest = @dest
				WHERE mapping_id = @mapping_id
			`);
		} else {
			await transaction
				.request()
				.input("mapping_id", sql.Int, mapping_id)
				.input("rm_status", sql.NVarChar, rm_status)
				.input("dest", sql.NVarChar, destlast)
				.input("qc_id", sql.Int, qc_id)
				.query(`
				UPDATE [PFCMv2].[dbo].[TrolleyRMMapping]
				SET rm_status = @rm_status, qc_id = @qc_id,dest = @dest
				WHERE mapping_id = @mapping_id
			`);
		}

		let adjusted_md_time = null;
		if (md_time) {
			adjusted_md_time = new Date(md_time);
			adjusted_md_time.setHours(adjusted_md_time.getHours() + 7);
		}

		// ✅ UPDATE History
		if (destlast === 'ไปบรรจุ') {
			await transaction
				.request()
				.input("mapping_id", sql.Int, mapping_id)
				.input("receiver", sql.NVarChar, operator)
				.input("tro_id", sql.NVarChar, tro_id)
				.input("Moisture", sql.NVarChar, Moisture)
				.input("percent_fine", sql.NVarChar, percent_fine)
				.input("Temp", sql.NVarChar, Temp)
				.input("md_time", sql.DateTime, adjusted_md_time)
				.input("rmm_line_name", sql.NVarChar, rmm_line_name)
				.input("weight_RM", sql.Float, weight_RM)
				.input("tray_count", sql.Int, tray_count)
				.input("dest", sql.NVarChar, destlast)
				.input("rework_time", sql.Int, rework_time)
				.input("mix_time", sql.Int, mix_time)
				.input("prep_to_pack_time", sql.Int, prep_to_pack_time)
				.query(`
				UPDATE [PFCMv2].[dbo].[History]
				SET receiver_qc = @receiver,
					tro_id = @tro_id,
					Moisture = @Moisture,
					Temp = @Temp,
					percent_fine = @percent_fine,
					md_time = @md_time,
					rmm_line_name = @rmm_line_name,
					weight_RM = @weight_RM,
					tray_count = @tray_count,
					dest = @dest,
					qc_date = GETDATE(),
					rework_time = @rework_time,
					mix_time = @mix_time,
					prep_to_pack_time = @prep_to_pack_time
				WHERE mapping_id = @mapping_id
			`);

			// ✅ เคลียร์รถเข็นเฉพาะตอน dest = 'ไปบรรจุ'
			if (tro_id) {
				await transaction
					.request()
					.input("tro_id", sql.NVarChar, tro_id)
					.query(`
					UPDATE [PFCMv2].[dbo].[Trolley]
					SET tro_status = 1
					WHERE tro_id = @tro_id
				`);

				await transaction
					.request()
					.input("mapping_id", sql.Int, mapping_id)
					.query(`
					UPDATE [PFCMv2].[dbo].[TrolleyRMMapping]
					SET tro_id = NULL
					WHERE mapping_id = @mapping_id
				`);

				console.log(`เคลียร์รถเข็น tro_id = ${tro_id} ให้เป็นว่างแล้ว`);
			}
		} else {
			await transaction
				.request()
				.input("mapping_id", sql.Int, mapping_id)
				.input("receiver", sql.NVarChar, operator)
				.input("tro_id", sql.NVarChar, tro_id)
				.input("Moisture", sql.NVarChar, Moisture)
				.input("percent_fine", sql.NVarChar, percent_fine)
				.input("Temp", sql.NVarChar, Temp)
				.input("md_time", sql.DateTime, adjusted_md_time)
				.input("rmm_line_name", sql.NVarChar, rmm_line_name)
				.input("weight_RM", sql.Float, weight_RM)
				.input("tray_count", sql.Int, tray_count)
				.input("dest", sql.NVarChar, destlast)
				.input("prepare_mor_night", sql.NVarChar, prepare_mor_night)
				.query(`
				UPDATE [PFCMv2].[dbo].[History]
				SET receiver_qc = @receiver,
					tro_id = @tro_id,
					Moisture = @Moisture,
					Temp = @Temp,
					percent_fine = @percent_fine,
					md_time = @md_time,
					rmm_line_name = @rmm_line_name,
					weight_RM = @weight_RM,
					tray_count = @tray_count,
					dest = @dest,
					prepare_mor_night = @prepare_mor_night,
					qc_date = GETDATE()
				WHERE mapping_id = @mapping_id
			`);
		}
		
		// ✅ ถ้า dest = 'ผสมเตรียม' และ QC ผ่านหมด ให้ INSERT เข้า MixToPack
if (destlast === 'ผสมเตรียม' && rm_status === 'QcCheck') {
	// ดึงข้อมูลจาก TrolleyRMMapping เพื่อ copy ไปยัง MixToPack
	const mappingData = await transaction
		.request()
		.input("mapping_id", sql.Int, mapping_id)
		.query(`
			SELECT 
				tro_id,
				rmfp_id,
				batch_id,
				tro_production_id,
				process_id,
				qc_id,
				weight_in_trolley,
				tray_count,
				weight_per_tray,
				weight_RM,
				level_eu,
				prep_to_cold_time,
				cold_time,
				prep_to_pack_time,
				cold_to_pack_time,
				rework_time,
				rm_status,
				rm_cold_status,
				stay_place,
				dest,
				mix_code,
				prod_mix,
				allocation_date,
				removal_date,
				status,
				production_batch,
				created_by,
				rmm_line_name,
				mix_time,
				from_mapping_id,
				tl_status
			FROM [PFCMv2].[dbo].[TrolleyRMMapping]
			WHERE mapping_id = @mapping_id
		`);

	if (mappingData.recordset.length > 0) {
		const data = mappingData.recordset[0];
		const old_tro_id = data.tro_id;

		// ✅ เพิ่มการตรวจสอบข้อมูลสำคัญ
		if (!data.rmfp_id) {
			console.error(`❌ ไม่พบ rmfp_id สำหรับ mapping_id: ${mapping_id}`);
			await transaction.rollback();
			return res.status(400).json({
				success: false,
				message: "ไม่พบข้อมูล rmfp_id ในระบบ"
			});
		}

		// INSERT เข้า MixToPack (mixtp_id เป็น IDENTITY)
		const insertMixToPackResult = await transaction
			.request()
			.input("rmfp_id", sql.Int, data.rmfp_id)
			.input("batch_id", sql.Int, data.batch_id)
			.input("tro_production_id", sql.Int, data.tro_production_id)
			.input("process_id", sql.Int, data.process_id)
			.input("qc_id", sql.Int, qc_id) // ✅ ใช้ qc_id ที่เพิ่ง INSERT
			.input("weight_in_trolley", sql.Float, data.weight_in_trolley)
			.input("tray_count", sql.Int, tray_count || data.tray_count) // ✅ ใช้ค่าใหม่ถ้ามี
			.input("weight_per_tray", sql.Float, data.weight_per_tray)
			.input("weight_RM", sql.Float, weight_RM || data.weight_RM) // ✅ ใช้ค่าใหม่ถ้ามี
			.input("level_eu", sql.NVarChar, data.level_eu)
			.input("prep_to_cold_time", sql.Int, data.prep_to_cold_time)
			.input("cold_time", sql.Int, data.cold_time)
			.input("prep_to_pack_time", sql.Int, prep_to_pack_time) // ✅ ใช้ค่าที่คำนวณแล้ว
			.input("cold_to_pack_time", sql.Int, data.cold_to_pack_time)
			.input("rework_time", sql.Int, rework_time) // ✅ ใช้ค่าที่คำนวณแล้ว
			.input("rm_status", sql.NVarChar, rm_status) // ✅ ใช้สถานะใหม่
			.input("rm_cold_status", sql.NVarChar, data.rm_cold_status)
			.input("stay_place", sql.NVarChar, data.stay_place)
			.input("dest", sql.NVarChar, destlast) // ✅ ใช้ dest ที่อัปเดตแล้ว
			.input("mix_code", sql.NVarChar, data.mix_code)
			.input("prod_mix", sql.NVarChar, data.prod_mix)
			.input("allocation_date", sql.DateTime, data.allocation_date)
			.input("removal_date", sql.DateTime, data.removal_date)
			.input("status", sql.NVarChar, data.status)
			.input("production_batch", sql.NVarChar, data.production_batch)
			.input("created_by", sql.NVarChar, operator) // ✅ ใช้ operator ปัจจุบัน
			.input("rmm_line_name", sql.NVarChar, rmm_line_name || data.rmm_line_name) // ✅ ใช้ค่าใหม่ถ้ามี
			.input("mix_time", sql.Int, mix_time) // ✅ ใช้ค่าที่คำนวณแล้ว
			.input("from_mapping_id", sql.Int, mapping_id) // ✅ อ้างอิงกลับไป mapping_id เดิม
			.input("tl_status", sql.NVarChar, data.tl_status)
			.query(`
				DECLARE @InsertedMixToPackTable TABLE (mixtp_id INT);
				
				INSERT INTO [PFCMv2].[dbo].[MixToPack]
					(tro_id, rmfp_id, batch_id, tro_production_id, process_id, qc_id,
					 weight_in_trolley, tray_count, weight_per_tray, weight_RM, level_eu,
					 prep_to_cold_time, cold_time, prep_to_pack_time, cold_to_pack_time,
					 rework_time, rm_status, rm_cold_status, stay_place, dest,
					 mix_code, prod_mix, allocation_date, removal_date, status,
					 production_batch, created_by, created_at, rmm_line_name, mix_time,
					 from_mapping_id, tl_status)
				OUTPUT INSERTED.mixtp_id INTO @InsertedMixToPackTable
				VALUES
					(NULL, @rmfp_id, @batch_id, @tro_production_id, @process_id, @qc_id,
					 @weight_in_trolley, @tray_count, @weight_per_tray, @weight_RM, @level_eu,
					 @prep_to_cold_time, @cold_time, @prep_to_pack_time, @cold_to_pack_time,
					 @rework_time, @rm_status, @rm_cold_status, @stay_place, @dest,
					 @mix_code, @prod_mix, @allocation_date, @removal_date, @status,
					 @production_batch, @created_by, GETDATE(), @rmm_line_name, @mix_time,
					 @from_mapping_id, @tl_status);
				
				SELECT mixtp_id FROM @InsertedMixToPackTable;
			`);

		const new_mixtp_id = insertMixToPackResult.recordset[0].mixtp_id;
		console.log(`✅ INSERT ข้อมูลเข้า MixToPack สำเร็จ (mixtp_id: ${new_mixtp_id})`);

		// เคลียร์รถเข็น
		if (old_tro_id) {
			await transaction
				.request()
				.input("tro_id", sql.NVarChar, old_tro_id)
				.query(`
					UPDATE [PFCMv2].[dbo].[Trolley]
					SET tro_status = 1
					WHERE tro_id = @tro_id
				`);

			await transaction
				.request()
				.input("mapping_id", sql.Int, mapping_id)
				.query(`
					UPDATE [PFCMv2].[dbo].[TrolleyRMMapping]
					SET tro_id = NULL
					WHERE mapping_id = @mapping_id
				`);

			console.log(`✅ เคลียร์รถเข็น tro_id = ${old_tro_id} ให้เป็นว่างแล้ว`);
		}
	} else {
		console.error(`❌ ไม่พบข้อมูล mapping_id: ${mapping_id} ใน TrolleyRMMapping`);
	}
}

		// ✅ Commit
		await transaction.commit();

		// ✅ Socket emit
		const io = req.app.get("io");
		const formattedData = {
			mappingId: mapping_id,
			qcId: qc_id,
			rmStatus: rm_status,
			qccheck,
			mdcheck: md_check,
			defectcheck: defect_check,
			updatedAt: new Date(),
			operator,
			dest,
			trayCount: tray_count,
			weightRM: weight_RM,
		};
		io.to("QcCheckRoom").emit("dataUpdated", formattedData);

		res.json({ success: true, message: "บันทึกข้อมูลสำเร็จ", qc_id });

	} catch (err) {
		console.error("SQL Error:", err);
		if (transaction) await transaction.rollback();
		res.status(500).json({
			success: false,
			message: "เกิดข้อผิดพลาดในระบบ",
			error: err.message,
			stack: err.stack,
		});
	}
});

router.post("/qc/checkV2", async (req, res) => {
	let transaction;
	try {
		const {
			mapping_id,
			color,
			odor,
			texture,
			sq_remark,
			md,
			md_remark,
			defect,
			defect_remark,
			Defectacceptance,
			Sensoryacceptance,
			md_no,
			operator,
			rm_status_qc,
			WorkAreaCode,
			Moisture,
			Temp,
			md_time,
			tro_id,
			percent_fine,
			weight_RM,
			rmm_line_name,
			tray_count,
			dest,
			general_remark,
			prepare_mor_night
		} = req.body;

		// ========================================
		// 📝 LOGGING - Request Info
		// ========================================
		console.log("=== QC Check Request ===");
		console.log("📥 mapping_id:", mapping_id);
		console.log("📥 dest:", dest);
		console.log("📥 tro_id:", tro_id);
		console.log("📥 operator:", operator);
		console.log("📊 QC Results:");
		console.log("  - color:", color);
		console.log("  - odor:", odor);
		console.log("  - texture:", texture);
		console.log("  - md:", md);
		console.log("  - defect:", defect);
		console.log("  - Sensoryacceptance:", Sensoryacceptance);
		console.log("  - Defectacceptance:", Defectacceptance);
		console.log("========================");

		// ========================================
		// ✅ VALIDATION - Input Data
		// ========================================
		if (
			!mapping_id ||
			isNaN(mapping_id) ||
			color === undefined ||
			odor === undefined ||
			texture === undefined ||
			md === undefined ||
			defect === undefined ||
			!operator ||
			!dest ||
			!tro_id ||
			weight_RM === undefined || 
			weight_RM === null ||
			tray_count === undefined || 
			tray_count === null ||
			(md === 1 && (!md_no || !WorkAreaCode))
		) {
			console.warn("⚠️ Validation Failed - Missing Required Fields");
			return res.status(400).json({
				success: false,
				message: "กรุณากรอกข้อมูลให้ครบถ้วน",
				missing_fields: {
					mapping_id: !mapping_id || isNaN(mapping_id),
					color: color === undefined,
					odor: odor === undefined,
					texture: texture === undefined,
					md: md === undefined,
					defect: defect === undefined,
					operator: !operator,
					dest: !dest,
					tro_id: !tro_id,
					weight_RM: weight_RM === undefined || weight_RM === null,
					tray_count: tray_count === undefined || tray_count === null,
					md_no: md === 1 && !md_no,
					WorkAreaCode: md === 1 && !WorkAreaCode
				}
			});
		}

		// ========================================
		// 🔄 DATE CONVERSION
		// ========================================
		let thaiMdDateTime = null;
		if (md_time) {
			try {
				const dateObj = new Date(md_time);
				dateObj.setHours(dateObj.getHours() + 7);
				thaiMdDateTime = dateObj;
				console.log("✅ MD Time converted:", thaiMdDateTime);
			} catch (error) {
				console.error("❌ Error parsing md_time:", error);
				thaiMdDateTime = null;
			}
		}

		const pool = await connectToDatabase();

		// ========================================
		// ✅ VALIDATION - Trolley Status
		// ========================================
		if (tro_id) {
			const trolleyCheck = await pool
				.request()
				.input("tro_id", sql.NVarChar, tro_id)
				.query(`
					SELECT tro_status
					FROM [PFCMv2].[dbo].[Trolley]
					WHERE tro_id = @tro_id
				`);

			if (trolleyCheck.recordset.length === 0) {
				console.warn(`⚠️ Trolley ${tro_id} not found`);
				return res.status(400).json({
					success: false,
					message: `ไม่พบรถเข็นหมายเลข ${tro_id} ในระบบ`
				});
			}

			const trolleyStatus = trolleyCheck.recordset[0].tro_status;
			console.log(`📦 Trolley ${tro_id} status:`, trolleyStatus);
		}

		// ========================================
		// ✅ VALIDATION - Metal Detector
		// ========================================
		if (Number(md) === 1) {
			const mdCheck = await pool
				.request()
				.input("md_no", sql.NVarChar, md_no)
				.query(`
					SELECT md_no
					FROM [PFCMv2].[dbo].[MetalDetectors]
					WHERE md_no = @md_no AND Status = CAST(1 AS BIT)
				`);

			if (mdCheck.recordset.length === 0) {
				console.warn(`⚠️ Metal Detector ${md_no} not found or inactive`);
				return res.status(400).json({
					success: false,
					message: `ไม่พบเครื่อง Metal Detector หมายเลข ${md_no} หรือเครื่องไม่พร้อมใช้งาน`,
				});
			}
			console.log(`✅ Metal Detector ${md_no} validated`);
		}

		// ========================================
		// ✅ VALIDATION - Mapping ID
		// ========================================
		const mappingCheck = await pool
			.request()
			.input("mapping_id", sql.Int, mapping_id)
			.query(`
				SELECT mapping_id
				FROM [PFCMv2].[dbo].[TrolleyRMMapping]
				WHERE mapping_id = @mapping_id
			`);

		if (mappingCheck.recordset.length === 0) {
			console.warn(`⚠️ Mapping ID ${mapping_id} not found`);
			return res.status(400).json({
				success: false,
				message: `ไม่พบ mapping_id ${mapping_id} ในระบบ`,
			});
		}
		console.log(`✅ Mapping ID ${mapping_id} validated`);

		// ========================================
		// 🎯 BUSINESS LOGIC - QC Status Determination
		// ========================================
		let destlast = dest;
		let rm_status = "QcCheck";
		let qccheck = "ผ่าน";
		let defect_check = "ผ่าน";
		let md_check = "ผ่าน";

		console.log("=== QC Status Determination ===");
		console.log("Original dest:", dest);

		// ตรวจสอบ Sensory Quality
		if ([color, odor, texture].includes(0) && Sensoryacceptance !== 1) {
			rm_status = "QcCheck รอแก้ไข";
			qccheck = "ไม่ผ่าน";
			destlast = "จุดเตรียม";
			console.log("❌ Sensory Quality Failed → destlast = 'จุดเตรียม'");
		}

		// ตรวจสอบ Defect
		if (defect === 0 && Defectacceptance !== 1) {
			rm_status = "QcCheck รอแก้ไข";
			defect_check = "ไม่ผ่าน";
			destlast = "จุดเตรียม";
			console.log("❌ Defect Check Failed → destlast = 'จุดเตรียม'");
		}

		// ตรวจสอบ Metal Detector
		if (md === 0) {
			if ((defect === 0 && Defectacceptance !== 1) || 
			    ([color, odor, texture].includes(0) && Sensoryacceptance !== 1)) {
				rm_status = "QcCheck รอแก้ไข";
				destlast = "จุดเตรียม";
				console.log("❌ MD + (Defect or Sensory) Failed → destlast = 'จุดเตรียม'");
			} else {
				rm_status = "QcCheck รอ MD";
				md_check = "รอผ่าน MD";
				console.log("⏳ Waiting for MD Check");
			}
		}

		// // ✅ กรณีพิเศษ: dest = 'รอCheckin' และ QC ผ่านทั้งหมด
		// if (dest === 'รอCheckin' && rm_status === 'QcCheck') {
		// 	destlast = 'เข้าห้องเย็น';
		// 	console.log("✅ Special Case: 'รอCheckin' → 'เข้าห้องเย็น' (QC Passed)");
		// }

		console.log("=== Final QC Results ===");
		console.log("✅ rm_status:", rm_status);
		console.log("✅ destlast:", destlast);
		console.log("✅ qccheck:", qccheck);
		console.log("✅ md_check:", md_check);
		console.log("✅ defect_check:", defect_check);
		console.log("========================");

		// ========================================
		// 🔄 START TRANSACTION
		// ========================================
		transaction = new sql.Transaction(pool);
		await transaction.begin();
		console.log("✅ Transaction started");

		// ========================================
		// 📊 FETCH TIME DATA
		// ========================================
		const timeData = await transaction
			.request()
			.input("mapping_id", sql.Int, mapping_id)
			.query(`
				SELECT 
					rmm.rework_time,
					rmm.mix_time,
					rmm.prep_to_pack_time,
					rmg.prep_to_pack
				FROM
					TrolleyRMMapping rmm
					JOIN RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
					JOIN RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
				WHERE mapping_id = @mapping_id
			`);

		let rework_time = null;
		let mix_time = null;
		let prep_to_pack_time = null;

		if (timeData.recordset.length > 0) {
			rework_time = timeData.recordset[0].rework_time;
			mix_time = timeData.recordset[0].mix_time;

			if (destlast === 'ไปบรรจุ') {
				prep_to_pack_time = timeData.recordset[0].prep_to_pack_time ?? 
				                   timeData.recordset[0].prep_to_pack;
			} else {
				prep_to_pack_time = timeData.recordset[0].prep_to_pack_time;
			}

			console.log("📊 Time Data Retrieved:");
			console.log("  - rework_time:", rework_time);
			console.log("  - mix_time:", mix_time);
			console.log("  - prep_to_pack_time:", prep_to_pack_time);
		}

		// ========================================
		// 💾 INSERT QC RECORD
		// ========================================
		console.log("💾 Inserting QC record...");
		const insertResult = await transaction
			.request()
			.input("color", sql.Bit, color ? 1 : 0)
			.input("odor", sql.Bit, odor ? 1 : 0)
			.input("texture", sql.Bit, texture ? 1 : 0)
			.input("sq_remark", sql.NVarChar, sq_remark || null)
			.input("md", sql.Bit, md ? 1 : 0)
			.input("md_remark", sql.NVarChar, md_remark || null)
			.input("defect", sql.Bit, defect ? 1 : 0)
			.input("defect_remark", sql.NVarChar, defect_remark || null)
			.input("Defectacceptance", sql.Bit, Defectacceptance ? 1 : 0)
			.input("Sensoryacceptance", sql.Bit, Sensoryacceptance ? 1 : 0)
			.input("md_no", sql.NVarChar, md_no || null)
			.input("WorkAreaCode", sql.NVarChar, WorkAreaCode || null)
			.input("qccheck", sql.NVarChar, qccheck)
			.input("md_check", sql.NVarChar, md_check)
			.input("defect_check", sql.NVarChar, defect_check)
			.input("Moisture", sql.NVarChar, Moisture || null)
			.input("Temp", sql.NVarChar, Temp || null)
			.input("md_time", sql.DateTime, thaiMdDateTime)
			.input("percent_fine", sql.NVarChar, percent_fine || null)
			.input("general_remark", sql.NVarChar, general_remark || null)
			.input("prepare_mor_night", sql.NVarChar, prepare_mor_night || null)
			.query(`
				DECLARE @InsertedTable TABLE (qc_id INT);
				INSERT INTO [PFCMv2].[dbo].[QC] 
					(color, odor, texture, sq_acceptance, sq_remark, md, md_remark, 
					 defect, defect_acceptance, defect_remark, md_no, WorkAreaCode, 
					 qccheck, mdcheck, defectcheck, Moisture, Temp, md_time, percent_fine, 
					 qc_datetime, general_remark, prepare_mor_night)
				OUTPUT INSERTED.qc_id INTO @InsertedTable
				VALUES 
					(@color, @odor, @texture, @Sensoryacceptance, @sq_remark, @md, 
					 @md_remark, @defect, @Defectacceptance, @defect_remark, @md_no, 
					 @WorkAreaCode, @qccheck, @md_check, @defect_check, @Moisture, @Temp, 
					 @md_time, @percent_fine, GETDATE(), @general_remark, @prepare_mor_night);
				SELECT qc_id FROM @InsertedTable;
			`);

		const qc_id = insertResult.recordset[0].qc_id;
		console.log(`✅ QC record inserted (qc_id: ${qc_id})`);

		// ========================================
		// 🔄 UPDATE TrolleyRMMapping
		// ========================================
		console.log("🔄 Updating TrolleyRMMapping...");
		if (destlast === 'ไปบรรจุ') {
			await transaction
				.request()
				.input("mapping_id", sql.Int, mapping_id)
				.input("rm_status", sql.NVarChar, rm_status)
				.input("dest", sql.NVarChar, destlast)
				.input("qc_id", sql.Int, qc_id)
				.input("prep_to_pack_time", sql.Int, prep_to_pack_time)
				.query(`
					UPDATE [PFCMv2].[dbo].[TrolleyRMMapping]
					SET rm_status = @rm_status, 
					    qc_id = @qc_id, 
					    prep_to_pack_time = @prep_to_pack_time, 
					    dest = @dest
					WHERE mapping_id = @mapping_id
				`);
			console.log("✅ TrolleyRMMapping updated (with prep_to_pack_time)");
		} else {
			await transaction
				.request()
				.input("mapping_id", sql.Int, mapping_id)
				.input("rm_status", sql.NVarChar, rm_status)
				.input("dest", sql.NVarChar, destlast)
				.input("qc_id", sql.Int, qc_id)
				.query(`
					UPDATE [PFCMv2].[dbo].[TrolleyRMMapping]
					SET rm_status = @rm_status, 
					    qc_id = @qc_id, 
					    dest = @dest
					WHERE mapping_id = @mapping_id
				`);
			console.log("✅ TrolleyRMMapping updated");
		}

		// ========================================
		// 🔄 UPDATE History
		// ========================================
		console.log("🔄 Updating History...");
		let adjusted_md_time = null;
		if (md_time) {
			adjusted_md_time = new Date(md_time);
			adjusted_md_time.setHours(adjusted_md_time.getHours() + 7);
		}

		if (destlast === 'ไปบรรจุ') {
			await transaction
				.request()
				.input("mapping_id", sql.Int, mapping_id)
				.input("receiver", sql.NVarChar, operator)
				.input("tro_id", sql.NVarChar, tro_id)
				.input("Moisture", sql.NVarChar, Moisture || null)
				.input("percent_fine", sql.NVarChar, percent_fine || null)
				.input("Temp", sql.NVarChar, Temp || null)
				.input("md_time", sql.DateTime, adjusted_md_time)
				.input("rmm_line_name", sql.NVarChar, rmm_line_name)
				.input("weight_RM", sql.Float, weight_RM)
				.input("tray_count", sql.Int, tray_count)
				.input("dest", sql.NVarChar, destlast)
				.input("rework_time", sql.Int, rework_time)
				.input("mix_time", sql.Int, mix_time)
				.input("prep_to_pack_time", sql.Int, prep_to_pack_time)
				.query(`
					UPDATE [PFCMv2].[dbo].[History]
					SET receiver_qc = @receiver,
					    tro_id = @tro_id,
					    Moisture = @Moisture,
					    Temp = @Temp,
					    percent_fine = @percent_fine,
					    md_time = @md_time,
					    rmm_line_name = @rmm_line_name,
					    weight_RM = @weight_RM,
					    tray_count = @tray_count,
					    dest = @dest,
					    qc_date = GETDATE(),
					    rework_time = @rework_time,
					    mix_time = @mix_time,
					    prep_to_pack_time = @prep_to_pack_time
					WHERE mapping_id = @mapping_id
				`);
			console.log("✅ History updated (ไปบรรจุ case)");

			// เคลียร์รถเข็น
			await clearTrolley(transaction, tro_id, mapping_id);

		} else {
			await transaction
				.request()
				.input("mapping_id", sql.Int, mapping_id)
				.input("receiver", sql.NVarChar, operator)
				.input("tro_id", sql.NVarChar, tro_id)
				.input("Moisture", sql.NVarChar, Moisture || null)
				.input("percent_fine", sql.NVarChar, percent_fine || null)
				.input("Temp", sql.NVarChar, Temp || null)
				.input("md_time", sql.DateTime, adjusted_md_time)
				.input("rmm_line_name", sql.NVarChar, rmm_line_name)
				.input("weight_RM", sql.Float, weight_RM)
				.input("tray_count", sql.Int, tray_count)
				.input("dest", sql.NVarChar, destlast)
				.input("prepare_mor_night", sql.NVarChar, prepare_mor_night || null)
				.query(`
					UPDATE [PFCMv2].[dbo].[History]
					SET receiver_qc = @receiver,
					    tro_id = @tro_id,
					    Moisture = @Moisture,
					    Temp = @Temp,
					    percent_fine = @percent_fine,
					    md_time = @md_time,
					    rmm_line_name = @rmm_line_name,
					    weight_RM = @weight_RM,
					    tray_count = @tray_count,
					    dest = @dest,
					    prepare_mor_night = @prepare_mor_night,
					    qc_date = GETDATE()
					WHERE mapping_id = @mapping_id
				`);
			console.log("✅ History updated");
		}

		// ========================================
		// 📦 MixToPack Process
		// ========================================
		if ((destlast === 'ผสมเตรียม' || dest === 'ผสมเตรียม') && rm_status === 'QcCheck') {
			console.log("=== Starting MixToPack Process ===");
			await processMixToPack(transaction, mapping_id, qc_id, {
				operator,
				tray_count,
				weight_RM,
				rmm_line_name,
				prep_to_pack_time,
				rework_time,
				mix_time,
				destlast
			});
			console.log("=== MixToPack Process Completed ===");
		}

		// ========================================
		// ✅ COMMIT TRANSACTION
		// ========================================
		await transaction.commit();
		console.log("✅ Transaction committed successfully");

		// ========================================
		// 📡 SOCKET EMIT
		// ========================================
		const io = req.app.get("io");
		if (io) {
			const formattedData = {
				mappingId: mapping_id,
				qcId: qc_id,
				rmStatus: rm_status,
				qccheck,
				mdcheck: md_check,
				defectcheck: defect_check,
				updatedAt: new Date(),
				operator,
				dest: destlast,
				trayCount: tray_count,
				weightRM: weight_RM,
			};
			io.to("QcCheckRoom").emit("dataUpdated", formattedData);
			console.log("📡 Socket event emitted to QcCheckRoom");
		}

		// ========================================
		// ✅ SUCCESS RESPONSE
		// ========================================
		console.log("=== QC Check Completed Successfully ===");
		res.json({ 
			success: true, 
			message: "บันทึกข้อมูลสำเร็จ", 
			qc_id,
			rm_status,
			dest: destlast
		});

	} catch (err) {
		// ========================================
		// ❌ ERROR HANDLING
		// ========================================
		console.error("=== QC Check Error ===");
		console.error("❌ Error Message:", err.message);
		console.error("❌ Error Stack:", err.stack);
		console.error("❌ Request Body:", JSON.stringify(req.body, null, 2));
		console.error("======================");

		if (transaction) {
			try {
				await transaction.rollback();
				console.log("✅ Transaction rolled back successfully");
			} catch (rollbackErr) {
				console.error("❌ Rollback failed:", rollbackErr);
			}
		}

		// ตรวจสอบประเภท error
		if (err.message.includes("FOREIGN KEY")) {
			return res.status(400).json({
				success: false,
				message: "ข้อมูลอ้างอิงไม่ถูกต้อง กรุณาตรวจสอบ mapping_id หรือ qc_id",
				error: process.env.NODE_ENV === 'development' ? err.message : undefined
			});
		}

		if (err.message.includes("UNIQUE")) {
			return res.status(409).json({
				success: false,
				message: "พบข้อมูลซ้ำในระบบ",
				error: process.env.NODE_ENV === 'development' ? err.message : undefined
			});
		}

		if (err.message.includes("Timeout")) {
			return res.status(504).json({
				success: false,
				message: "การเชื่อมต่อหมดเวลา กรุณาลองใหม่อีกครั้ง",
				error: process.env.NODE_ENV === 'development' ? err.message : undefined
			});
		}

		res.status(500).json({
			success: false,
			message: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง",
			error: process.env.NODE_ENV === 'development' ? err.message : undefined,
			stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
		});
	}
});

// ========================================
// 🔧 HELPER FUNCTIONS
// ========================================

/**
 * เคลียร์รถเข็น (ตั้งสถานะเป็นว่าง)
 */
async function clearTrolley(transaction, tro_id, mapping_id) {
	if (!tro_id) {
		console.log("⚠️ ไม่มี tro_id ให้เคลียร์");
		return false;
	}

	try {
		console.log(`🧹 Clearing trolley: ${tro_id}`);

		// เคลียร์สถานะรถเข็น
		await transaction
			.request()
			.input("tro_id", sql.NVarChar, tro_id)
			.query(`
				UPDATE [PFCMv2].[dbo].[Trolley]
				SET tro_status = 1
				WHERE tro_id = @tro_id
			`);

		// เอา tro_id ออกจาก TrolleyRMMapping
		await transaction
			.request()
			.input("mapping_id", sql.Int, mapping_id)
			.query(`
				UPDATE [PFCMv2].[dbo].[TrolleyRMMapping]
				SET tro_id = NULL
				WHERE mapping_id = @mapping_id
			`);

		console.log(`✅ Trolley ${tro_id} cleared successfully`);
		return true;
	} catch (error) {
		console.error(`❌ Failed to clear trolley ${tro_id}:`, error);
		throw error;
	}
}

/**
 * ประมวลผล MixToPack (สำหรับ dest = 'ผสมเตรียม')
 */
async function processMixToPack(transaction, mapping_id, qc_id, params) {
	const {
		operator,
		tray_count,
		weight_RM,
		rmm_line_name,
		prep_to_pack_time,
		rework_time,
		mix_time,
		destlast
	} = params;

	console.log("📦 Fetching mapping data for MixToPack...");

	// ดึงข้อมูลจาก TrolleyRMMapping
	const mappingData = await transaction
		.request()
		.input("mapping_id", sql.Int, mapping_id)
		.query(`
			SELECT 
				tro_id, rmfp_id, batch_id, tro_production_id, process_id,
				weight_in_trolley, tray_count, weight_per_tray, weight_RM, level_eu,
				prep_to_cold_time, cold_time, prep_to_pack_time, cold_to_pack_time,
				rework_time, rm_status, rm_cold_status, stay_place, dest,
				mix_code, prod_mix, allocation_date, removal_date, status,
				production_batch, created_by, rmm_line_name, mix_time, tl_status
			FROM [PFCMv2].[dbo].[TrolleyRMMapping]
			WHERE mapping_id = @mapping_id
		`);

	if (mappingData.recordset.length === 0) {
		const errorMsg = `ไม่พบข้อมูล mapping_id: ${mapping_id} ใน TrolleyRMMapping`;
		console.error(`❌ ${errorMsg}`);
		throw new Error(errorMsg);
	}

	const data = mappingData.recordset[0];
	
	// Validation
	if (!data.rmfp_id) {
		const errorMsg = `ไม่พบ rmfp_id สำหรับ mapping_id: ${mapping_id}`;
		console.error(`❌ ${errorMsg}`);
		throw new Error("ไม่พบข้อมูล rmfp_id ในระบบ");
	}

	const old_tro_id = data.tro_id;
	
	console.log("📦 Mapping Data:", {
		rmfp_id: data.rmfp_id,
		tro_id: old_tro_id,
		weight_RM: weight_RM || data.weight_RM,
		tray_count: tray_count || data.tray_count
	});

	// INSERT เข้า MixToPack
	console.log("💾 Inserting into MixToPack...");
	const insertMixToPackResult = await transaction
		.request()
		.input("rmfp_id", sql.Int, data.rmfp_id)
		.input("batch_id", sql.Int, data.batch_id)
		.input("tro_production_id", sql.Int, data.tro_production_id)
		.input("process_id", sql.Int, data.process_id)
		.input("qc_id", sql.Int, qc_id)
		.input("weight_in_trolley", sql.Float, data.weight_in_trolley)
		.input("tray_count", sql.Int, tray_count || data.tray_count)
		.input("weight_per_tray", sql.Float, data.weight_per_tray)
		.input("weight_RM", sql.Float, weight_RM || data.weight_RM)
		.input("level_eu", sql.NVarChar, data.level_eu)
		.input("prep_to_cold_time", sql.Int, data.prep_to_cold_time)
		.input("cold_time", sql.Int, data.cold_time)
		.input("prep_to_pack_time", sql.Int, prep_to_pack_time || data.prep_to_pack_time)
		.input("cold_to_pack_time", sql.Int, data.cold_to_pack_time)
		.input("rework_time", sql.Int, rework_time || data.rework_time)
		.input("rm_status", sql.NVarChar, "QcCheck")
		.input("rm_cold_status", sql.NVarChar, data.rm_cold_status)
		.input("stay_place", sql.NVarChar, "ผสมเตรียม")
		.input("dest", sql.NVarChar, destlast)
		.input("mix_code", sql.NVarChar, data.mix_code)
		.input("prod_mix", sql.NVarChar, data.prod_mix)
		.input("allocation_date", sql.DateTime, data.allocation_date)
		.input("removal_date", sql.DateTime, data.removal_date)
		.input("status", sql.NVarChar, data.status)
		.input("production_batch", sql.NVarChar, data.production_batch)
		.input("created_by", sql.NVarChar, operator)
		.input("rmm_line_name", sql.NVarChar, rmm_line_name || data.rmm_line_name)
		.input("mix_time", sql.Int, mix_time || data.mix_time)
		.input("from_mapping_id", sql.Int, mapping_id)
		.input("tl_status", sql.NVarChar, data.tl_status)
		.query(`
			DECLARE @InsertedMixToPackTable TABLE (mixtp_id INT);
			
			INSERT INTO [PFCMv2].[dbo].[MixToPack]
				(tro_id, rmfp_id, batch_id, tro_production_id, process_id, qc_id,
				 weight_in_trolley, tray_count, weight_per_tray, weight_RM, level_eu,
				 prep_to_cold_time, cold_time, prep_to_pack_time, cold_to_pack_time,
				 rework_time, rm_status, rm_cold_status, stay_place, dest,
				 mix_code, prod_mix, allocation_date, removal_date, status,
				 production_batch, created_by, created_at, rmm_line_name, mix_time,
				 from_mapping_id, tl_status)
			OUTPUT INSERTED.mixtp_id INTO @InsertedMixToPackTable
			VALUES
				(NULL, @rmfp_id, @batch_id, @tro_production_id, @process_id, @qc_id,
				 @weight_in_trolley, @tray_count, @weight_per_tray, @weight_RM, @level_eu,
				 @prep_to_cold_time, @cold_time, @prep_to_pack_time, @cold_to_pack_time,
				 @rework_time, @rm_status, @rm_cold_status, @stay_place, @dest,
				 @mix_code, @prod_mix, @allocation_date, @removal_date, @status,
				 @production_batch, @created_by, GETDATE(), @rmm_line_name, @mix_time,
				 @from_mapping_id, @tl_status);
			
			SELECT mixtp_id FROM @InsertedMixToPackTable;
		`);

	const new_mixtp_id = insertMixToPackResult.recordset[0].mixtp_id;
	console.log(`✅ MixToPack record inserted (mixtp_id: ${new_mixtp_id})`);

	// เคลียร์รถเข็น
	if (old_tro_id) {
		await clearTrolley(transaction, old_tro_id, mapping_id);
	}

	return new_mixtp_id;
}

	router.get("/history/cold-dates", async (req, res) => {
  try {
    const { mapping_id } = req.query;
    
    console.log('📥 Received mapping_id:', mapping_id);
    
    if (!mapping_id) {
      return res.status(400).json({
        success: false,
        message: 'mapping_id is required'
      });
    }

    const sql = require("mssql");
    const pool = await connectToDatabase();

    console.log('🔍 Executing query for mapping_id:', mapping_id);

    const result = await pool.request()
      .input("mapping_id", sql.Int, mapping_id)
      .query(`
        SELECT 
          come_cold_date,
          out_cold_date,
          come_cold_date_two,      -- 🆕 เพิ่ม
          out_cold_date_two,       -- 🆕 เพิ่ม
          come_cold_date_three,      -- 🆕 เพิ่ม
          out_cold_date_three,       -- 🆕 เพิ่ม
          mapping_id,
          CONVERT(varchar(16), come_cold_date, 120) AS come_cold_date_formatted,
          CONVERT(varchar(16), out_cold_date, 120) AS out_cold_date_formatted,
          CONVERT(varchar(16), come_cold_date_two, 120) AS come_cold_date_two_formatted,    -- 🆕 เพิ่ม
          CONVERT(varchar(16), out_cold_date_two, 120) AS out_cold_date_two_formatted,      -- 🆕 เพิ่ม
          CONVERT(varchar(16), come_cold_date_three, 120) AS come_cold_date_three_formatted,    -- 🆕 เพิ่ม
          CONVERT(varchar(16), out_cold_date_three, 120) AS out_cold_date_three_formatted       -- 🆕 เพิ่ม
        FROM History
        WHERE mapping_id = @mapping_id
      `);

    console.log('✅ Query results:', result.recordset);

    if (result.recordset.length > 0) {
      const data = result.recordset[0];
      
      // 🆕 เพิ่มการตรวจสอบทุกคู่
      const hasBothDates = data.come_cold_date && data.out_cold_date;
      const hasBothDates2 = data.come_cold_date_two && data.out_cold_date_two;
      const hasBothDates3 = data.come_cold_date_three && data.out_cold_date_three;
      
      console.log('✅ Data found:', { 
        data, 
        hasBothDates, 
        hasBothDates2, 
        hasBothDates3 
      });
      
      return res.json({
        success: true,
        data: data,
        hasBothDates: hasBothDates,
        hasBothDates2: hasBothDates2,    
        hasBothDates3: hasBothDates3      
      });
    } else {
      console.log('⚠️ No data found for mapping_id:', mapping_id);
      
      return res.json({
        success: false,
        data: null,
        message: 'No cold date records found'
      });
    }
  } catch (err) {
    console.error('❌ Error fetching cold dates:', err);
    console.error('❌ Error message:', err.message);
    
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


	router.get("/qc/print/status", async (req, res) => {
		try {
			const { mapping_id } = req.query; // ใช้ query parameter
			const sql = require("mssql");
			const pool = await connectToDatabase();

			const result = await pool.request()
				.input("mapping_id", sql.Int, mapping_id)
				.query(`
        SELECT 
          rmm.qc_id,
          qc.qccheck,
          qc.mdcheck,
          qc.defectcheck,
          FORMAT(qc.md_time, 'yyyy-MM-dd HH:mm') AS md_time_formatted,
          FORMAT(qc.qc_datetime, 'yyyy-MM-dd HH:mm') AS qc_datetime_formatted,
          qc.Moisture,
          qc.percent_fine,
          qc.Temp,
          qc.sq_remark,
          qc.md_remark,
          qc.defect_remark,
          qc.sq_acceptance,
          qc.defect_acceptance,
          qc.general_remark,
          htr.receiver,
          htr.receiver_qc,
          CONCAT(qc.WorkAreaCode, '-', mwa.WorkAreaName) AS WorkAreaCode,
          qc.md_no,
          rmm.rm_status,
          htr.location,
          htr.first_prod,
          htr.two_prod,
          htr.three_prod,
          htr.name_edit_prod_two,
          htr.name_edit_prod_three,
          htr.prepare_mor_night,
		  htr.rmit_date,
	CONVERT(varchar(16), htr.rmit_date, 120) AS rmit_date_formatted,
		  htr.withdraw_date,
    CONVERT(varchar(16), htr.withdraw_date, 120) AS withdraw_date_formatted
		  
        FROM TrolleyRMMapping rmm
        JOIN QC qc ON rmm.qc_id = qc.qc_id
        JOIN History htr ON rmm.mapping_id = htr.mapping_id
        LEFT JOIN WorkAreas mwa ON qc.WorkAreaCode = mwa.WorkAreaCode
        WHERE rmm.mapping_id = @mapping_id;
      `);

			if (result.recordset.length === 0) {
				return res.status(404).json({ success: false, message: "Data not found" });
			}

			res.json({ success: true, data: result.recordset[0] });
		} catch (err) {
			console.error("SQL error", err);
			res.status(500).json({ success: false, error: err.message });
		}
	});

	router.get("/qc/History/All", async (req, res) => {
		try {
			const { page = 1, pageSize = 20 } = req.query;
			const rm_type_ids = req.query.rm_type_ids; // รับ rm_type_ids จาก query parameters

			if (!rm_type_ids) {
				return res.status(400).json({ success: false, error: "RM Type IDs are required" });
			}

			const rmTypeIdsArray = rm_type_ids.split(',');
			const offset = (page - 1) * pageSize;
			console.log('Request params:', { page, pageSize, offset, rm_type_ids });

			console.log('Connecting to database...');
			const pool = await connectToDatabase();
			console.log('Database connected, executing query...');

			// 1. Query สำหรับนับจำนวนทั้งหมด (พร้อมกรอง rm_type_id)
			const countQuery = `
      SELECT COUNT(*) AS total
      FROM RMForProd rmf
      JOIN TrolleyRMMapping rmm ON rmf.rmfp_id = rmm.rmfp_id
      JOIN ProdRawMat pr ON rmm.tro_production_id = pr.prod_rm_id
      JOIN RawMat rm ON pr.mat = rm.mat
      JOIN Production p ON pr.prod_id = p.prod_id
      JOIN RawMatGroup rmg ON rmg.rm_group_id = rmf.rm_group_id
      JOIN History htr ON rmm.mapping_id = htr.mapping_id
      JOIN Batch b ON rmm.batch_id = b.batch_id
      JOIN QC q ON rmm.qc_id = q.qc_id
      WHERE rmg.rm_type_id IN (${rmTypeIdsArray.map(t => `'${t}'`).join(',')})
    `;

			const countResult = await pool.request().query(countQuery);
			const totalRows = countResult.recordset[0].total;

			// 2. Query หลักพร้อม pagination และกรอง rm_type_id
			const mainQuery = `
     SELECT
    rmm.mapping_id,
    rmf.rmfp_id,
    STRING_AGG(CAST(b.batch_after AS VARCHAR(50)), CHAR(10)) AS batch_after,
    rm.mat,
    rm.mat_name,
    CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,
    htr.rmm_line_name,
    htr.tray_count,
    htr.weight_RM,
    htr.dest,
    rmg.rm_type_id,
    ps.process_name,
    htr.tro_id,
    rmm.level_eu,
    rmf.rm_group_id AS rmf_rm_group_id,
    rmg.rm_group_id AS rmg_rm_group_id,
    rmm.rm_status,
    htr.cooked_date,
    q.general_remark,
    q.sq_remark,
    q.md,
    q.md_remark,
    q.defect,
    q.defect_remark,
    q.md_no,
    CONCAT(q.WorkAreaCode, '-', mwa.WorkAreaName) AS WorkAreaCode,
    q.qccheck,
    q.mdcheck,
    q.defectcheck,
    q.sq_acceptance,
    q.defect_acceptance,
    htr.receiver,
    htr.receiver_qc,
    q.Moisture,
    q.Temp,
    FORMAT(q.md_time, 'yyyy-MM-dd HH:mm') AS md_time_formatted,
    q.percent_fine,
    FORMAT(q.qc_datetime, 'yyyy-MM-dd HH:mm') AS qc_datetime_formatted,
    FORMAT(htr.rmit_date, 'yyyy-MM-dd HH:mm') AS rmit_date,
    REPLACE(LEFT(htr.withdraw_date, 16), 'T', ' ') AS withdraw_date_formatted,
    htr.rework_time,
    htr.prep_to_pack_time,
    htr.first_prod,
    htr.two_prod,
    htr.three_prod,
    htr.name_edit_prod_two,
    htr.name_edit_prod_three,
    htr.prepare_mor_night,
    htr.remark_rework,
    htr.remark_rework_cold,
    htr.edit_rework,
    htr.created_at
  FROM
    RMForProd rmf
  JOIN TrolleyRMMapping rmm ON rmf.rmfp_id = rmm.rmfp_id
  JOIN ProdRawMat pr ON rmm.tro_production_id = pr.prod_rm_id
  JOIN RawMat rm ON pr.mat = rm.mat
  JOIN Process ps ON rmm.process_id = ps.process_id
  JOIN Production p ON pr.prod_id = p.prod_id
  JOIN RawMatGroup rmg ON rmg.rm_group_id = rmf.rm_group_id
  JOIN History htr ON rmm.mapping_id = htr.mapping_id
  JOIN Batch b ON rmm.mapping_id = b.mapping_id  -- เปลี่ยน join ให้ตรงกับ mapping_id
  JOIN QC q ON rmm.qc_id = q.qc_id
  LEFT JOIN WorkAreas mwa ON q.WorkAreaCode = mwa.WorkAreaCode
  WHERE rmg.rm_type_id IN (${rmTypeIdsArray.map(t => `'${t}'`).join(',')})
    AND htr.stay_place = 'จุดเตรียม'
    AND (htr.dest = 'เข้าห้องเย็น' OR htr.dest = 'ไปบรรจุ')
  GROUP BY
    rmm.mapping_id,
    rmf.rmfp_id,
    rm.mat,
    rm.mat_name,
    p.doc_no,
    rmm.rmm_line_name,
    htr.rmm_line_name,
    htr.tray_count,
    htr.weight_RM,
    htr.dest,
    rmg.rm_type_id,
    ps.process_name,
    htr.tro_id,
    rmm.level_eu,
    rmf.rm_group_id,
    rmg.rm_group_id,
    rmm.rm_status,
    htr.cooked_date,
    q.general_remark,
    q.sq_remark,
    q.md,
    q.md_remark,
    q.defect,
    q.defect_remark,
    q.md_no,
    q.WorkAreaCode,
    mwa.WorkAreaName,
    q.qccheck,
    q.mdcheck,
    q.defectcheck,
    q.sq_acceptance,
    q.defect_acceptance,
    htr.receiver,
    htr.receiver_qc,
    q.Moisture,
    q.Temp,
    q.md_time,
    q.percent_fine,
    q.qc_datetime,
    htr.rmit_date,
    htr.withdraw_date,
    htr.rework_time,
    htr.prep_to_pack_time,
    htr.first_prod,
    htr.two_prod,
    htr.three_prod,
    htr.name_edit_prod_two,
    htr.name_edit_prod_three,
    htr.prepare_mor_night,
    htr.remark_rework,
    htr.remark_rework_cold,
    htr.edit_rework,
    htr.created_at
  ORDER BY qc_datetime DESC
  OFFSET @offset ROWS
  FETCH NEXT @pageSize ROWS ONLY
    `;

			const result = await pool.request()
				.input('offset', sql.Int, offset)
				.input('pageSize', sql.Int, pageSize)
				.query(mainQuery);

			console.log("Data fetched:", result.recordset.length, 'records');

			const formattedData = result.recordset.map(item => {
				const date = new Date(item.cooked_date);
				const year = date.getUTCFullYear();
				const month = String(date.getUTCMonth() + 1).padStart(2, '0');
				const day = String(date.getUTCDate()).padStart(2, '0');
				const hours = String(date.getUTCHours()).padStart(2, '0');
				const minutes = String(date.getUTCMinutes()).padStart(2, '0');

				item.CookedDateTime = `${year}-${month}-${day} ${hours}:${minutes}`;
				delete item.cooked_date;

				item.WorkAreaCode = item.WorkAreaCode || null;

				return item;
			});

			console.log('Sending response with', formattedData.length, 'records');
			res.json({ success: true, data: formattedData, total: totalRows });
		} catch (err) {
			console.error("SQL error:", err);
			res.status(500).json({ success: false, error: err.message });
		}
	});


	router.put("/update-destination", async (req, res) => {
		try {
			console.log("Received Request:", req.body);
			const { tro_id, dest, cold_time } = req.body;
			if (!tro_id || !dest || !cold_time) {
				console.log("Missing required fields:", { tro_id, dest });
				return res.status(400).json({ error: "Missing required fields" });
			}
			let rm_status = "รับฝาก-รอแก้ไข"; // กำหนดสถานะให้เป็น "รอแก้ไข"
			const new_stay_place = "ออกห้องเย็น"; // เพิ่มตัวแปรสำหรับ stay_place
			const pool = await connectToDatabase();

			// 1. อัปเดตสถานะ, ปลายทาง และ stay_place ในตาราง RMInTrolley
			const updateRMResult = await pool.request()
				.input("tro_id", tro_id)
				.input("dest", dest)
				.input("cold_time", cold_time)
				.input("rm_status", rm_status)
				.input("new_stay_place", new_stay_place) // เพิ่ม input parameter

				.query(`
					UPDATE RMInTrolley
					SET dest = @dest,
						cold_time = @cold_time,
						rm_status = @rm_status,
						stay_place = @new_stay_place,
						rm_cold_status = NULL
					WHERE tro_id = @tro_id 
					AND stay_place IN ('เข้าห้องเย็น') -- แก้เงื่อนไขตามที่ต้องการ
				`);

			// ส่วนที่เหลือคงเดิม...

			// 2. ค้นหา tro_id ที่เกี่ยวข้องกับ rmfp_id ที่กำลังอัปเดต
			const findTrolleyResult = await pool.request()
				.input("tro_id", tro_id)
				.query(`
					SELECT tro_id 
					FROM RMInTrolley
					WHERE tro_id = @tro_id
				`);

			// 3. หากพบ tro_id ให้อัปเดตตาราง Slot โดยตั้งค่า tro_id เป็น NULL
			if (findTrolleyResult.recordset.length > 0) {
				const tro_id = findTrolleyResult.recordset[0].tro_id;

				// อัปเดต tro_id เป็น NULL ในตาราง Slot
				const updateSlotResult = await pool.request()
					.input("tro_id", tro_id)
					.query(`
						UPDATE Slot
						SET tro_id = NULL
						WHERE tro_id = @tro_id
					`);

				console.log(`✅ อัปเดต tro_id เป็น NULL สำเร็จ จำนวน ${updateSlotResult.rowsAffected[0]} แถว`);
			}

			if (updateRMResult.rowsAffected[0] === 0) {
				return res.status(404).json({ error: "ไม่พบรายการที่ต้องการอัปเดต หรือรายการไม่ได้อยู่ในสถานะที่กำหนด" });
			}

			console.log(`✅ อัปเดต tro_id: ${tro_id}, dest: ${dest}, rm_status: ${rm_status}, stay_place: ${new_stay_place} สำเร็จ`);
			return res.json({
				message: "อัปเดตข้อมูลสำเร็จ",
				tro_id,
				dest,
				rm_status,
				stay_place: new_stay_place
			});
		} catch (error) {
			console.error("❌ Error updating data:", error);
			return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
		}
	});

	// ดึงข้อมูลเครื่องตรวจจับโลหะทั้งหมด
	router.get("/metal-detectors", async (req, res) => {
		try {
			// เชื่อมต่อกับฐานข้อมูล
			const pool = await connectToDatabase();
			// ดึงข้อมูลจากตาราง MetalDetectors
			const result = await pool.request()
				.query('SELECT md_no, Status FROM PFCMv2.dbo.MetalDetectors');

			// ส่งข้อมูลกลับในรูปแบบ JSON พร้อมสถานะ success
			res.json({
				success: true,
				data: result.recordset
			});
		} catch (err) {
			// บันทึกข้อผิดพลาดและส่งกลับข้อความแจ้งเตือน
			console.error('Error fetching metal detectors:', err);
			res.status(500).json({
				success: false,
				error: 'Failed to retrieve metal detectors',
				errorDetails: err.message
			});
		}
	});

	// ดึงข้อมูลเครื่องตรวจจับโลหะตามรหัส
	router.get("/metal-detectors/:id", async (req, res) => {
		try {
			// รับค่า id จาก URL parameter
			const { id } = req.params;
			// เชื่อมต่อกับฐานข้อมูล
			const pool = await connectToDatabase();
			// ค้นหาเครื่องตรวจจับโลหะด้วยรหัส
			const result = await pool.request()
				.input('md_no', sql.NVarChar, id) // กำหนดค่าพารามิเตอร์เพื่อป้องกัน SQL Injection
				.query('SELECT md_no, Status FROM PFCMv2.dbo.MetalDetectors WHERE md_no = @md_no');

			// ตรวจสอบว่าพบข้อมูลหรือไม่
			if (result.recordset.length === 0) {
				// ถ้าไม่พบข้อมูล ส่งข้อความแจ้งเตือน 404
				return res.status(404).json({
					success: false,
					error: 'Metal detector not found'
				});
			}

			// ส่งข้อมูลกลับในรูปแบบ JSON
			res.json({
				success: true,
				data: result.recordset[0]
			});
		} catch (err) {
			// บันทึกข้อผิดพลาดและส่งกลับข้อความแจ้งเตือน
			console.error('Error fetching metal detector:', err);
			res.status(500).json({
				success: false,
				error: 'Failed to retrieve metal detector',
				errorDetails: err.message
			});
		}
	});

	// เพิ่มเครื่องตรวจจับโลหะใหม่
	router.post("/sup/metal-detectors", async (req, res) => {
		try {
			// รับข้อมูลจาก request body
			const { md_no, Status } = req.body;

			// ตรวจสอบข้อมูลที่จำเป็น
			if (!md_no) {
				// ถ้าไม่มีรหัสเครื่อง ส่งข้อความแจ้งเตือน
				return res.status(400).json({
					success: false,
					error: 'Metal detector number (md_no) is required'
				});
			}

			// เชื่อมต่อกับฐานข้อมูล
			const pool = await connectToDatabase();

			// ตรวจสอบว่ามีเครื่องตรวจจับโลหะนี้อยู่แล้วหรือไม่
			const checkResult = await pool.request()
				.input('md_no', sql.NVarChar, md_no)
				.query('SELECT md_no FROM PFCMv2.dbo.MetalDetectors WHERE md_no = @md_no');

			// ถ้ามีข้อมูลอยู่แล้ว ส่งข้อความแจ้งเตือน
			if (checkResult.recordset.length > 0) {
				return res.status(409).json({
					success: false,
					error: 'Metal detector with this number already exists'
				});
			}

			// กำหนดค่าเริ่มต้นสำหรับสถานะถ้าไม่ได้ระบุมา
			const statusValue = Status !== undefined ? Status : 1; // ค่า 1 คือ active (เปิดใช้งาน)

			// เพิ่มข้อมูลเครื่องตรวจจับโลหะใหม่
			await pool.request()
				.input('md_no', sql.NVarChar, md_no)
				.input('Status', sql.Int, statusValue)
				.query('INSERT INTO PFCMv2.dbo.MetalDetectors (md_no, Status) VALUES (@md_no, @Status)');

			// ส่งข้อความแจ้งเตือนว่าสำเร็จ
			res.status(201).json({
				success: true,
				message: 'Metal detector added successfully'
			});
		} catch (err) {
			// บันทึกข้อผิดพลาดและส่งกลับข้อความแจ้งเตือน
			console.error('Error adding metal detector:', err);
			res.status(500).json({
				success: false,
				error: 'Failed to add metal detector',
				errorDetails: err.message
			});
		}
	});

	// อัพเดทข้อมูลเครื่องตรวจจับโลหะ
	router.put("/sup/metal-detectors/:id", async (req, res) => {
		try {
			// รับค่า id จาก URL parameter และข้อมูลจาก request body
			const { id } = req.params;
			const { Status } = req.body;

			// ตรวจสอบว่ามีการระบุสถานะหรือไม่
			if (Status === undefined) {
				// ถ้าไม่มีสถานะ ส่งข้อความแจ้งเตือน
				return res.status(400).json({
					success: false,
					error: 'Status is required for update'
				});
			}

			// เชื่อมต่อกับฐานข้อมูล
			const pool = await connectToDatabase();

			// ตรวจสอบว่ามีเครื่องตรวจจับโลหะนี้อยู่หรือไม่
			const checkResult = await pool.request()
				.input('md_no', sql.NVarChar, id)
				.query('SELECT md_no FROM PFCMv2.dbo.MetalDetectors WHERE md_no = @md_no');

			// ถ้าไม่พบข้อมูล ส่งข้อความแจ้งเตือน
			if (checkResult.recordset.length === 0) {
				return res.status(404).json({
					success: false,
					error: 'Metal detector not found'
				});
			}

			// อัพเดทข้อมูลเครื่องตรวจจับโลหะ
			await pool.request()
				.input('md_no', sql.NVarChar, id)
				.input('Status', sql.Int, Status)
				.query('UPDATE PFCMv2.dbo.MetalDetectors SET Status = @Status WHERE md_no = @md_no');

			// ส่งข้อความแจ้งเตือนว่าสำเร็จ
			res.json({
				success: true,
				message: 'Metal detector updated successfully'
			});
		} catch (err) {
			// บันทึกข้อผิดพลาดและส่งกลับข้อความแจ้งเตือน
			console.error('Error updating metal detector:', err);
			res.status(500).json({
				success: false,
				error: 'Failed to update metal detector',
				errorDetails: err.message
			});
		}
	});

	// ลบเครื่องตรวจจับโลหะ
	router.delete("/sup/metal-detectors/:id", async (req, res) => {
		try {
			// รับค่า id จาก URL parameter
			const { id } = req.params;

			// เชื่อมต่อกับฐานข้อมูล
			const pool = await connectToDatabase();

			// ตรวจสอบว่ามีเครื่องตรวจจับโลหะนี้อยู่หรือไม่
			const checkResult = await pool.request()
				.input('md_no', sql.NVarChar, id)
				.query('SELECT md_no FROM PFCMv2.dbo.MetalDetectors WHERE md_no = @md_no');

			// ถ้าไม่พบข้อมูล ส่งข้อความแจ้งเตือน
			if (checkResult.recordset.length === 0) {
				return res.status(404).json({
					success: false,
					error: 'Metal detector not found'
				});
			}

			// ลบข้อมูลเครื่องตรวจจับโลหะ
			await pool.request()
				.input('md_no', sql.NVarChar, id)
				.query('DELETE FROM PFCMv2.dbo.MetalDetectors WHERE md_no = @md_no');

			// ส่งข้อความแจ้งเตือนว่าสำเร็จ
			res.json({
				success: true,
				message: 'Metal detector deleted successfully'
			});
		} catch (err) {
			// บันทึกข้อผิดพลาดและส่งกลับข้อความแจ้งเตือน
			console.error('Error deleting metal detector:', err);
			res.status(500).json({
				success: false,
				error: 'Failed to delete metal detector',
				errorDetails: err.message
			});
		}
	});


	// ดึงข้อมูลพื้นที่ทำงานทั้งหมด
	router.get("/work-areas", async (req, res) => {
		try {
			// เชื่อมต่อกับฐานข้อมูล
			const pool = await connectToDatabase();
			// ดึงข้อมูลจากตาราง WorkAreas
			const result = await pool.request()
				.query('SELECT WorkAreaCode, WorkAreaName,CONCAT(WorkAreaCode, \'-\', WorkAreaName) AS DisplayName FROM PFCMv2.dbo.WorkAreas');

			// ส่งข้อมูลกลับในรูปแบบ JSON
			res.json({
				success: true,
				data: result.recordset
			});
		} catch (err) {
			// บันทึกข้อผิดพลาดและส่งกลับข้อความแจ้งเตือน
			console.error('Error fetching work areas:', err);
			res.status(500).json({
				success: false,
				error: 'Failed to retrieve work areas',
				errorDetails: err.message
			});
		}
	});

	// ดึงข้อมูลพื้นที่ทำงานตามรหัส
	router.get("/work-areas/:id", async (req, res) => {
		try {
			// รับค่า id จาก URL parameter
			const { id } = req.params;
			// เชื่อมต่อกับฐานข้อมูล
			const pool = await connectToDatabase();
			// ค้นหาพื้นที่ทำงานด้วยรหัส
			const result = await pool.request()
				.input('WorkAreaCode', sql.NVarChar, id)
				.query('SELECT WorkAreaCode, WorkAreaName FROM PFCMv2.dbo.WorkAreas WHERE WorkAreaCode = @WorkAreaCode');

			// ตรวจสอบว่าพบข้อมูลหรือไม่
			if (result.recordset.length === 0) {
				// ถ้าไม่พบข้อมูล ส่งข้อความแจ้งเตือน 404
				return res.status(404).json({
					success: false,
					error: 'Work area not found'
				});
			}

			// ส่งข้อมูลกลับในรูปแบบ JSON
			res.json({
				success: true,
				data: result.recordset[0]
			});
		} catch (err) {
			// บันทึกข้อผิดพลาดและส่งกลับข้อความแจ้งเตือน
			console.error('Error fetching work area:', err);
			res.status(500).json({
				success: false,
				error: 'Failed to retrieve work area',
				errorDetails: err.message
			});
		}
	});

	// เพิ่มพื้นที่ทำงานใหม่
	router.post("/sup/work-areas", async (req, res) => {
		try {
			// รับข้อมูลจาก request body
			const { WorkAreaCode, WorkAreaName } = req.body;

			// ตรวจสอบข้อมูลที่จำเป็น
			if (!WorkAreaCode || !WorkAreaName) {
				// ถ้าไม่มีรหัสหรือชื่อพื้นที่ ส่งข้อความแจ้งเตือน
				return res.status(400).json({
					success: false,
					error: 'Work area code and name are required'
				});
			}

			// เชื่อมต่อกับฐานข้อมูล
			const pool = await connectToDatabase();

			// ตรวจสอบว่ามีพื้นที่ทำงานนี้อยู่แล้วหรือไม่
			const checkResult = await pool.request()
				.input('WorkAreaCode', sql.NVarChar, WorkAreaCode)
				.query('SELECT WorkAreaCode FROM PFCMv2.dbo.WorkAreas WHERE WorkAreaCode = @WorkAreaCode');

			// ถ้ามีข้อมูลอยู่แล้ว ส่งข้อความแจ้งเตือน
			if (checkResult.recordset.length > 0) {
				return res.status(409).json({
					success: false,
					error: 'Work area with this code already exists'
				});
			}

			// เพิ่มข้อมูลพื้นที่ทำงานใหม่
			await pool.request()
				.input('WorkAreaCode', sql.NVarChar, WorkAreaCode)
				.input('WorkAreaName', sql.NVarChar, WorkAreaName)
				.query('INSERT INTO PFCMv2.dbo.WorkAreas (WorkAreaCode, WorkAreaName) VALUES (@WorkAreaCode, @WorkAreaName)');

			// ส่งข้อความแจ้งเตือนว่าสำเร็จ
			res.status(201).json({
				success: true,
				message: 'Work area added successfully'
			});
		} catch (err) {
			// บันทึกข้อผิดพลาดและส่งกลับข้อความแจ้งเตือน
			console.error('Error adding work area:', err);
			res.status(500).json({
				success: false,
				error: 'Failed to add work area',
				errorDetails: err.message
			});
		}
	});

	// อัพเดทข้อมูลพื้นที่ทำงาน
	router.put("/sup/work-areas/:id", async (req, res) => {
		try {
			// รับค่า id จาก URL parameter และข้อมูลจาก request body
			const { id } = req.params;
			const { WorkAreaName } = req.body;

			// ตรวจสอบว่ามีการระบุชื่อพื้นที่หรือไม่
			if (!WorkAreaName) {
				// ถ้าไม่มีชื่อพื้นที่ ส่งข้อความแจ้งเตือน
				return res.status(400).json({
					success: false,
					error: 'Work area name is required for update'
				});
			}

			// เชื่อมต่อกับฐานข้อมูล
			const pool = await connectToDatabase();

			// ตรวจสอบว่ามีพื้นที่ทำงานนี้อยู่หรือไม่
			const checkResult = await pool.request()
				.input('WorkAreaCode', sql.NVarChar, id)
				.query('SELECT WorkAreaCode FROM PFCMv2.dbo.WorkAreas WHERE WorkAreaCode = @WorkAreaCode');

			// ถ้าไม่พบข้อมูล ส่งข้อความแจ้งเตือน
			if (checkResult.recordset.length === 0) {
				return res.status(404).json({
					success: false,
					error: 'Work area not found'
				});
			}

			// อัพเดทข้อมูลพื้นที่ทำงาน
			await pool.request()
				.input('WorkAreaCode', sql.NVarChar, id)
				.input('WorkAreaName', sql.NVarChar, WorkAreaName)
				.query('UPDATE PFCMv2.dbo.WorkAreas SET WorkAreaName = @WorkAreaName WHERE WorkAreaCode = @WorkAreaCode');

			// ส่งข้อความแจ้งเตือนว่าสำเร็จ
			res.json({
				success: true,
				message: 'Work area updated successfully'
			});
		} catch (err) {
			// บันทึกข้อผิดพลาดและส่งกลับข้อความแจ้งเตือน
			console.error('Error updating work area:', err);
			res.status(500).json({
				success: false,
				error: 'Failed to update work area',
				errorDetails: err.message
			});
		}
	});

	// ลบพื้นที่ทำงาน
	router.delete("/sup/work-areas/:id", async (req, res) => {
		try {
			// รับค่า id จาก URL parameter
			const { id } = req.params;

			// เชื่อมต่อกับฐานข้อมูล
			const pool = await connectToDatabase();

			// ตรวจสอบว่ามีพื้นที่ทำงานนี้อยู่หรือไม่
			const checkResult = await pool.request()
				.input('WorkAreaCode', sql.NVarChar, id)
				.query('SELECT WorkAreaCode FROM PFCMv2.dbo.WorkAreas WHERE WorkAreaCode = @WorkAreaCode');

			// ถ้าไม่พบข้อมูล ส่งข้อความแจ้งเตือน
			if (checkResult.recordset.length === 0) {
				return res.status(404).json({
					success: false,
					error: 'Work area not found'
				});
			}

			// ลบข้อมูลพื้นที่ทำงาน
			await pool.request()
				.input('WorkAreaCode', sql.NVarChar, id)
				.query('DELETE FROM PFCMv2.dbo.WorkAreas WHERE WorkAreaCode = @WorkAreaCode');

			// ส่งข้อความแจ้งเตือนว่าสำเร็จ
			res.json({
				success: true,
				message: 'Work area deleted successfully'
			});
		} catch (err) {
			// บันทึกข้อผิดพลาดและส่งกลับข้อความแจ้งเตือน
			console.error('Error deleting work area:', err);
			res.status(500).json({
				success: false,
				error: 'Failed to delete work area',
				errorDetails: err.message
			});
		}
	});


	// API สำหรับแก้ไขวันที่/เวลา QC ตรวจสอบ
	router.post("/update-qc-datetime", async (req, res) => {
		let transaction;
		try {
			const { mapping_id, qc_datetime } = req.body;

			// 1. ตรวจสอบข้อมูลที่จำเป็น
			if (!mapping_id || !qc_datetime) {
				return res.status(400).json({
					success: false,
					message: "กรุณาระบุ mapping_id และวันที่/เวลา",
				});
			}

			// 2. เชื่อมต่อฐานข้อมูล
			const pool = await connectToDatabase();

			// 3. ตรวจสอบว่า mapping_id มีอยู่และมีการเชื่อมโยงกับ qc_id
			const mappingCheck = await pool
				.request()
				.input("mapping_id", sql.Int, mapping_id)
				.query(`
				SELECT qc_id
				FROM [PFCMv2].[dbo].[TrolleyRMMapping]
				WHERE mapping_id = @mapping_id AND qc_id IS NOT NULL
			`);

			if (mappingCheck.recordset.length === 0) {
				return res.status(404).json({
					success: false,
					message: `ไม่พบข้อมูล QC สำหรับ mapping_id ${mapping_id}`,
				});
			}

			const qc_id = mappingCheck.recordset[0].qc_id;

			// ✅ 4. ดึง tro_id จากตาราง History
			const historyCheck = await pool
				.request()
				.input("mapping_id", sql.Int, mapping_id)
				.query(`
				SELECT tro_id
				FROM [PFCMv2].[dbo].[History]
				WHERE mapping_id = @mapping_id
			`);

			let tro_id = null;
			if (historyCheck.recordset.length > 0) {
				tro_id = historyCheck.recordset[0].tro_id;
			}

			// 5. เริ่ม Transaction
			transaction = new sql.Transaction(pool);
			await transaction.begin();

			// 6. อัปเดตวันที่/เวลา QC ในตาราง QC
			await transaction
				.request()
				.input("qc_id", sql.Int, qc_id)
				.input("qc_datetime", sql.DateTime, new Date(qc_datetime))
				.query(`
				UPDATE [PFCMv2].[dbo].[QC]
				SET qc_datetime = @qc_datetime
				WHERE qc_id = @qc_id
			`);

			// 7. อัปเดตวันที่ QC ในตาราง History
			await transaction
				.request()
				.input("mapping_id", sql.Int, mapping_id)
				.input("qc_date", sql.DateTime, new Date(qc_datetime))
				.query(`
				UPDATE [PFCMv2].[dbo].[History]
				SET qc_date = @qc_date
				WHERE mapping_id = @mapping_id
			`);

			// 8. Commit Transaction
			await transaction.commit();

			// 9. ส่งการแจ้งเตือนผ่าน Socket.io (ถ้ามีการใช้งาน)
			const broadcastData = {
				message: "QC datetime has been updated successfully!",
				mapping_id,
				qc_id,
				tro_id, // ✅ เพิ่ม tro_id ใน broadcast ด้วย
			};
			if (req.app.get("io")) {
				req.app.get("io").to("QcCheckRoom").emit("qcDateTimeUpdated", broadcastData);
			}

			// 10. ส่ง Response
			res.json({
				success: true,
				message: "อัปเดตวันที่/เวลาสำเร็จ",
				mapping_id,
				qc_id,
				tro_id,
				qc_datetime_formatted: new Date(qc_datetime).toLocaleString("th-TH"),
			});
		} catch (err) {
			console.error("SQL Error:", err);
			if (transaction) {
				await transaction.rollback();
			}
			res.status(500).json({
				success: false,
				message: "เกิดข้อผิดพลาดในระบบ",
				error: err.message,
			});
		}
	});


	router.post("/update-md-datetime", async (req, res) => {
		let transaction;
		try {
			const { mapping_id, md_time } = req.body;

			// 1. ตรวจสอบข้อมูลที่จำเป็น
			if (!mapping_id || !md_time) {
				return res.status(400).json({
					success: false,
					message: "กรุณาระบุ mapping_id และวันที่/เวลา",
				});
			}

			// 2. เชื่อมต่อฐานข้อมูล
			const pool = await connectToDatabase();

			// 3. ตรวจสอบว่า mapping_id มีอยู่และมีการเชื่อมโยงกับ qc_id
			const mappingCheck = await pool
				.request()
				.input("mapping_id", sql.Int, mapping_id)
				.query(`
		  SELECT qc_id
		  FROM [PFCMv2].[dbo].[TrolleyRMMapping]
		  WHERE mapping_id = @mapping_id AND qc_id IS NOT NULL
		`);

			if (mappingCheck.recordset.length === 0) {
				return res.status(404).json({
					success: false,
					message: `ไม่พบข้อมูล QC สำหรับ mapping_id ${mapping_id}`,
				});
			}

			const qc_id = mappingCheck.recordset[0].qc_id;

			// 4. เริ่ม Transaction
			transaction = new sql.Transaction(pool);
			await transaction.begin();

			// 5. อัปเดตวันที่/เวลา QC ในตาราง QC
			await transaction
				.request()
				.input("qc_id", sql.Int, qc_id)
				.input("md_time", sql.DateTime, new Date(md_time))
				.query(`
		  UPDATE [PFCMv2].[dbo].[QC]
		  SET md_time = @md_time
		  WHERE qc_id = @qc_id
		`);

			// 6. อัปเดตวันที่ QC ในตาราง History (ถ้าต้องการ)
			await transaction
				.request()
				.input("mapping_id", sql.Int, mapping_id)
				.input("md_time", sql.DateTime, new Date(md_time))
				.query(`
		  UPDATE [PFCMv2].[dbo].[History]
		  SET md_time = @md_time
		  WHERE mapping_id = @mapping_id
		`);

			// 7. Commit Transaction
			await transaction.commit();

			// 8. ส่งการแจ้งเตือนผ่าน Socket.io (ถ้ามีการใช้งาน)
			const broadcastData = {
				message: "QC datetime has been updated successfully!",
				mapping_id,
				qc_id,
			};
			if (req.app.get("io")) {
				req.app.get("io").to("QcCheckRoom").emit("qcDateTimeUpdated", broadcastData);
			}

			// 9. ส่ง Response
			res.json({
				success: true,
				message: "อัปเดตวันที่/เวลาสำเร็จ",
				md_time_formatted: new Date(md_time).toLocaleString('th-TH')
			});
		} catch (err) {
			console.error("SQL Error:", err);
			if (transaction) {
				await transaction.rollback();
			}
			res.status(500).json({
				success: false,
				message: "เกิดข้อผิดพลาดในระบบ",
				error: err.message,
			});
		}
	});

	//   router.post("/update-cold-datetime", async (req, res) => {
	// 	let transaction;
	// 	try {
	// 	  const { mapping_id, qc_cold_time } = req.body;

	// 	  // 1. ตรวจสอบข้อมูลที่จำเป็น
	// 	  if (!mapping_id || !qc_cold_time) {
	// 		return res.status(400).json({
	// 		  success: false,
	// 		  message: "กรุณาระบุ mapping_id และวันที่/เวลา",
	// 		});
	// 	  }

	// 	  // 2. เชื่อมต่อฐานข้อมูล
	// 	  const pool = await connectToDatabase();

	// 	  // 3. ตรวจสอบว่า mapping_id มีอยู่และมีการเชื่อมโยงกับ qc_id
	// 	  const mappingCheck = await pool
	// 		.request()
	// 		.input("mapping_id", sql.Int, mapping_id)
	// 		.query(`
	// 		  SELECT qc_id
	// 		  FROM [PFCMv2].[dbo].[TrolleyRMMapping]
	// 		  WHERE mapping_id = @mapping_id AND qc_id IS NOT NULL
	// 		`);

	// 	  if (mappingCheck.recordset.length === 0) {
	// 		return res.status(404).json({
	// 		  success: false,
	// 		  message: `ไม่พบข้อมูล QC สำหรับ mapping_id ${mapping_id}`,
	// 		});
	// 	  }

	// 	  const qc_id = mappingCheck.recordset[0].qc_id;

	// 	  // 4. เริ่ม Transaction
	// 	  transaction = new sql.Transaction(pool);
	// 	  await transaction.begin();

	// 	  // 5. อัปเดตวันที่/เวลา QC ในตาราง QC
	// 	  await transaction
	// 		.request()
	// 		.input("qc_id", sql.Int, qc_id)
	// 		.input("qc_cold_time", sql.DateTime, new Date(qc_cold_time))
	// 		.query(`
	// 		  UPDATE [PFCMv2].[dbo].[QC]
	// 		  SET qc_cold_time = @qc_cold_time
	// 		  WHERE qc_id = @qc_id
	// 		`);

	// 	  // 6. อัปเดตวันที่ QC ในตาราง History (ถ้าต้องการ)
	// 	  await transaction
	// 		.request()
	// 		.input("mapping_id", sql.Int, mapping_id)
	// 		.input("qc_cold_time", sql.DateTime, new Date(qc_cold_time))
	// 		.query(`
	// 		  UPDATE [PFCMv2].[dbo].[History]
	// 		  SET qc_cold_time = @qc_cold_time
	// 		  WHERE mapping_id = @mapping_id
	// 		`);

	// 	  // 7. Commit Transaction
	// 	  await transaction.commit();

	// 	  // 8. ส่งการแจ้งเตือนผ่าน Socket.io (ถ้ามีการใช้งาน)
	// 	  const broadcastData = {
	// 		message: "QC coldtime has been updated successfully!",
	// 		mapping_id,
	// 		qc_id,
	// 	  };
	// 	  if (req.app.get("io")) {
	// 		req.app.get("io").to("QcCheckRoom").emit("qcColdTimeUpdated", broadcastData);
	// 	  }

	// 	  // 9. ส่ง Response
	// 	  res.json({ 
	// 		success: true, 
	// 		message: "อัปเดตวันที่/เวลาสำเร็จ", 
	// 		qc_cold_time_formatted: new Date(qc_cold_time).toLocaleString('th-TH')
	// 	  });
	// 	} catch (err) {
	// 	  console.error("SQL Error:", err);
	// 	  if (transaction) {
	// 		await transaction.rollback();
	// 	  }
	// 	  res.status(500).json({
	// 		success: false,
	// 		message: "เกิดข้อผิดพลาดในระบบ",
	// 		error: err.message,
	// 	  });
	// 	}
	//   });


	module.exports = router;
	return router;
};