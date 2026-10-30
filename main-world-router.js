"use strict";

(() => {
  let armedUntil = 0;
  let watchedPatientCode = "";
  let watchedPatientUntil = 0;
  const CONFIRM_ENDPOINT = "/api/integrate/drcare/xacnhandenkham";
  const REGISTER_EXAM_ENDPOINT = "/api/common/kbhkhambenh/dangkykham";
  const PATIENT_LIST_ENDPOINT = "https://ytcs-gw.hmis.vn/api/common/kbhphongkhamdangky/danhsachkhambenh";
  const START_EXAM_ENDPOINT = "https://ytcs-gw.hmis.vn/api/common/kbhphongkhamdangky/batdaukham";
  const PATIENT_DETAIL_ENDPOINT = "https://ytcs-gw.hmis.vn/api/billing/chuyenbaohiem/getThongTinBenhNhan";
  const gatewayRequestHeaders = {};
  let lastGatewayHeaderAt = 0;

  document.addEventListener("reception-watch-patient-search", event => {
    watchedPatientCode = String(event.detail || "").trim().toUpperCase();
    watchedPatientUntil = Date.now() + 30000;
  });

  const activePatientWatch = () => watchedPatientCode && Date.now() <= watchedPatientUntil;
  const normalizePatientCode = value => String(value || "").trim().toUpperCase();

  const patientListRecord = (payload, patientCode) => {
    const expected = normalizePatientCode(patientCode);
    const records = Array.isArray(payload?.data?.content) ? payload.data.content : [];
    const matches = records.filter(record =>
      normalizePatientCode(record?.benhNhan?.maBenhNhan) === expected
    );
    if(matches.length !== 1) return null;
    const id = String(matches[0]?.id ?? "").trim();
    return /^\d+$/.test(id) && Number(id) > 0 ? matches[0] : null;
  };

  const dispatchPatientId = (maBn, id, source = "api") => {
    watchedPatientCode = "";
    watchedPatientUntil = 0;
    document.dispatchEvent(new CustomEvent("reception-patient-search-id", {
      detail:JSON.stringify({maBn:normalizePatientCode(maBn), id:String(id), source})
    }));
  };

  const dispatchPatientSearchError = (maBn, message, fatal = false) => {
    document.dispatchEvent(new CustomEvent("reception-patient-search-error", {
      detail:JSON.stringify({maBn:normalizePatientCode(maBn), message, fatal})
    }));
  };

  const announcePatientIdFromResponse = async payload => {
    if(!activePatientWatch() || payload == null) return;
    const maBn = watchedPatientCode;
    const record = patientListRecord(payload, maBn);
    if(!record) return;
    try {
      await ensureExaminationStarted(record);
      dispatchPatientId(maBn, record.id, "watched-response");
    } catch(error) {
      dispatchPatientSearchError(maBn, error?.message || "Không chuyển được trạng thái sang Đang khám.", true);
    }
  };

  const inspectPatientSearchText = text => {
    if(!activePatientWatch() || !text) return;
    try { announcePatientIdFromResponse(JSON.parse(text)).catch(() => {}); } catch {}
  };

  const payloadObject = body => {
    if(!body) return null;
    if(typeof body === "string") {
      try { return JSON.parse(body); } catch {}
      try { return Object.fromEntries(new URLSearchParams(body)); } catch {}
      return null;
    }
    if(body instanceof URLSearchParams || body instanceof FormData)
      return Object.fromEntries(body.entries());
    return typeof body === "object" ? body : null;
  };

  const isConfirmUrl = value => {
    try {
      const pathname = new URL(String(value), location.href).pathname.replace(/\/+$/, "").toLowerCase();
      return pathname.endsWith(CONFIRM_ENDPOINT.toLowerCase());
    }
    catch { return false; }
  };

  const isRegisterExamUrl = value => {
    try {
      const pathname = new URL(String(value), location.href).pathname.replace(/\/+$/, "").toLowerCase();
      return pathname.endsWith(REGISTER_EXAM_ENDPOINT.toLowerCase());
    }
    catch { return false; }
  };

  const readableRequestBody = async (input, init) => {
    const body = init?.body;
    if(body != null) {
      if(typeof body === "string" || body instanceof URLSearchParams || body instanceof FormData)
        return body;
      if(body instanceof Blob) return await body.text();
      if(body instanceof ArrayBuffer) return new TextDecoder().decode(body);
      if(ArrayBuffer.isView(body))
        return new TextDecoder().decode(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
      return body;
    }
    if(input instanceof Request) {
      try { return await input.clone().text(); }
      catch { return null; }
    }
    return null;
  };

  const isGatewayUrl = value => {
    try { return new URL(String(value), location.href).hostname === "ytcs-gw.hmis.vn"; }
    catch { return false; }
  };

  const rememberGatewayHeader = (name, value) => {
    const key = String(name || "").trim();
    const normalized = key.toLowerCase();
    const replayable = new Set([
      "accept", "accept-language", "content-type", "authorization",
      "x-custom-header", "region-code", "skip-authorization", "x-screen-path"
    ]);
    if(!key || !replayable.has(normalized)) return;
    gatewayRequestHeaders[key] = String(value ?? "");
    lastGatewayHeaderAt = Date.now();
  };

  const rememberFetchHeaders = (input, init) => {
    try {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      headers.forEach((value, name) => rememberGatewayHeader(name, value));
    } catch {}
  };

  const announceConfirmedPatient = body => {
    const payload = payloadObject(body);
    const maBn = String(payload?.MA_BN ?? payload?.ma_bn ?? "").trim();
    if(!maBn) return;
    const detail = JSON.stringify({
      maBn,
      maLuotKhamHis:String(payload?.MALUOTKHAM_HIS ?? "").trim(),
      maHoSoBenhAn:String(payload?.MAHOSOBENHAN ?? "").trim()
    });
    sessionStorage.setItem("receptionDrcareConfirmed", detail);
    document.dispatchEvent(new CustomEvent("reception-drcare-confirmed", {detail}));
  };

  const announceRegisteredPatient = payload => {
    const data = payload?.data || payload;
    const maBn = String(data?.maBenhNhan ?? data?.MA_BN ?? "").trim();
    if(!maBn || (payload?.code != null && Number(payload.code) !== 0)) return;
    const detail = JSON.stringify({
      maBn,
      maLuotKhamHis:String(data?.khamBenhId ?? data?.MALUOTKHAM_HIS ?? "").trim(),
      maHoSoBenhAn:String(data?.maHoSoBenhAn ?? data?.MAHOSOBENHAN ?? "").trim(),
      tiepNhanId:String(data?.tiepNhanId ?? "").trim(),
      hoSoBenhAnId:String(data?.hoSoBenhAnId ?? "").trim(),
      benhNhanId:String(data?.benhNhanId ?? "").trim(),
      source:"dangkykham"
    });
    sessionStorage.setItem("receptionDrcareConfirmed", detail);
    document.dispatchEvent(new CustomEvent("reception-drcare-confirmed", {detail}));
  };

  const originalFetch = window.fetch.bind(window);

  const waitForGatewayHeaders = async (timeout = 4000) => {
    const started = Date.now();
    while(!Object.keys(gatewayRequestHeaders).length && Date.now() - started < timeout)
      await new Promise(resolve => setTimeout(resolve, 100));
  };

  const fetchGatewayJson = async url => {
    await waitForGatewayHeaders();
    let lastError;
    for(let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await originalFetch(url, {
          // The gateway answers with Access-Control-Allow-Origin: *. A credentialed
          // cross-origin fetch cannot expose that response to JavaScript. HMIS
          // authentication is already carried by the captured Authorization header.
          credentials:"omit",
          headers:{Accept:"application/json", ...gatewayRequestHeaders},
          signal:controller.signal
        });
        if(!response.ok) {
          const body = await response.clone().text().catch(() => "");
          const detail = body.replace(/\s+/g, " ").trim().slice(0, 220);
          throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
        }
        return await response.json();
      } catch(error) {
        lastError = error?.name === "AbortError"
          ? new Error("API không phản hồi trong 30 giây")
          : error;
      } finally {
        clearTimeout(timer);
      }
      if(attempt < 2) await new Promise(resolve => setTimeout(resolve, 700));
    }
    const context = Object.keys(gatewayRequestHeaders).length
      ? `đã lấy ${Object.keys(gatewayRequestHeaders).length} header HMIS`
      : "chưa bắt được header xác thực HMIS";
    throw new Error(`${lastError?.message || "Không lấy được response"} (${context}${lastGatewayHeaderAt ? `, cập nhật ${Math.round((Date.now() - lastGatewayHeaderAt) / 1000)} giây trước` : ""}).`);
  };

  const currentUserId = () => {
    const authorizationEntry = Object.entries(gatewayRequestHeaders)
      .find(([name]) => name.toLowerCase() === "authorization");
    const token = String(authorizationEntry?.[1] || "").replace(/^Bearer\s+/i, "").trim();
    if(token) {
      try {
        const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(decodeURIComponent(Array.from(atob(encoded), char =>
          `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`
        ).join("")));
        const id = Number(payload?.jti || payload?.userId || payload?.id);
        if(Number.isFinite(id) && id > 0) return id;
      } catch {}
    }
    return 0;
  };

  const positiveId = (value, label) => {
    const id = Number(value);
    if(!Number.isFinite(id) || id <= 0) throw new Error(`Thiếu ${label} để bắt đầu khám.`);
    return id;
  };

  const startExamPromises = new Map();
  const ensureExaminationStarted = record => {
    const registrationId = positiveId(record?.id, "phongKhamDangKyId");
    if(Number(record?.trangThaiStt) === 4 || Number(record?.khamBenh?.trangThaiKhamBenh) === 4)
      return Promise.resolve({alreadyStarted:true});
    if(Number(record?.trangThaiStt) !== 1)
      return Promise.reject(new Error(`Hồ sơ đang ở trạng thái ${record?.trangThaiStt ?? "không xác định"}, không thể chuyển từ Chưa khám sang Đang khám.`));
    if(startExamPromises.has(registrationId)) return startExamPromises.get(registrationId);

    const operation = (async () => {
      await waitForGatewayHeaders();
      const payload = {
        bsiKhamId:positiveId(currentUserId() || record?.bsKhamBenhId || record?.nguoiDungId, "bsiKhamId"),
        dichVuKhamId:positiveId(record?.dichVuId, "dichVuKhamId"),
        doiTuongBenhNhanId:positiveId(record?.khamBenh?.doiTuongBenhNhanId, "doiTuongBenhNhanId"),
        hoSoBenhAnId:positiveId(record?.khamBenh?.hoSoBenhAn?.id, "hoSoBenhAnId"),
        khamBenhId:positiveId(record?.khamBenh?.id, "khamBenhId"),
        maTheBhyt:record?.khamBenh?.tiepNhan?.bhyt?.maBhyt ?? null,
        mapConfirmReq:{},
        phongKhamDangKyId:registrationId,
        phongThietLapId:positiveId(record?.phong?.id, "phongThietLapId"),
        tiepNhanId:positiveId(record?.khamBenh?.tiepNhan?.id, "tiepNhanId")
      };
      const response = await originalFetch(START_EXAM_ENDPOINT, {
        method:"POST",
        credentials:"omit",
        headers:{Accept:"application/json", ...gatewayRequestHeaders, "Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);
      if(!response.ok) throw new Error(result?.message || `API bắt đầu khám trả về HTTP ${response.status}`);
      if(result?.code != null && Number(result.code) !== 0)
        throw new Error(result.message || "API bắt đầu khám báo lỗi.");
      const messages = result?.data?.listMessages;
      if(messages) {
        const message = Array.isArray(messages) ? messages.join("; ") : String(messages);
        throw new Error(message || "API bắt đầu khám yêu cầu xác nhận thêm.");
      }
      return {alreadyStarted:false};
    })().finally(() => startExamPromises.delete(registrationId));
    startExamPromises.set(registrationId, operation);
    return operation;
  };

  const formatLocalDate = date => [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear()
  ].join("/");

  const fetchPatientIdFromListApi = async patientCode => {
    const maBn = normalizePatientCode(patientCode);
    if(!maBn) return;
    watchedPatientCode = maBn;
    watchedPatientUntil = Date.now() + 30000;
    let lastError = "Không tìm thấy bệnh nhân trong danh sách khám bệnh.";
    for(let attempt = 0; attempt < 8; attempt++) {
      try {
        const date = formatLocalDate(new Date());
        const filter = `phongId==201;trangThaiId==0;chuoiMaTimKiem=="${maBn.replace(/[";]/g, "")}";tuNgay=="${date} 00:00:00";denNgay=="${date} 23:59:59"`;
        const url = new URL(PATIENT_LIST_ENDPOINT);
        url.searchParams.set("filter", filter);
        url.searchParams.set("page", "0");
        url.searchParams.set("size", "50");
        url.searchParams.append("sort", "ngay");
        url.searchParams.append("sort", "desc");
        const response = await originalFetch(url.href, {
          credentials:"omit",
          headers:{Accept:"application/json", ...gatewayRequestHeaders}
        });
        if(!response.ok) throw new Error(`API trả về HTTP ${response.status}`);
        const payload = await response.json();
        const record = patientListRecord(payload, maBn);
        if(record) {
          try {
            await ensureExaminationStarted(record);
          } catch(error) {
            dispatchPatientSearchError(maBn, error?.message || "Không chuyển được trạng thái sang Đang khám.", true);
            return;
          }
          dispatchPatientId(maBn, record.id, "direct-api");
          return;
        }
      } catch(error) {
        lastError = error?.message || lastError;
      }
      if(attempt < 7) await new Promise(resolve => setTimeout(resolve, 600));
    }
    dispatchPatientSearchError(maBn, lastError, false);
  };

  document.addEventListener("reception-fetch-patient-list", event => {
    fetchPatientIdFromListApi(event.detail).catch(() => {});
  });

  const normalizePersonName = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, match => match === "Đ" ? "D" : "d")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("vi-VN");

  const normalizeBirthDate = value => String(value || "").replace(/\D/g, "").slice(0, 8);
  const displayBirthDate = value => {
    const text = String(value || "").trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : text.split(" ")[0];
  };
  const apiFilterDate = value => {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
  };
  const patientGender = patient => Number(patient?.gioiTinhId) === 2 ? "Nữ" :
    Number(patient?.gioiTinhId) === 1 ? "Nam" : String(patient?.gioiTinh || "").trim();

  const fetchExistingPatientMatches = async request => {
    const fullName = String(request.fullName || "").trim();
    const expectedName = normalizePersonName(fullName);
    const expectedBirthDate = normalizeBirthDate(request.birthDate);
    const expectedGender = request.gender === "Nữ" ? "Nữ" : "Nam";
    const fromDate = apiFilterDate(request.fromDate);
    const toDate = formatLocalDate(new Date());
    if(!expectedName || expectedBirthDate.length !== 8 || !fromDate || !toDate)
      throw new Error("Thiếu tên, ngày sinh hoặc khoảng ngày hợp lệ để kiểm tra.");

    const safeName = fullName.replace(/[";\\]/g, " ").replace(/\s+/g, " ").trim();
    const filter = `phongId==201;trangThaiId==0;chuoiMaTimKiem=="";tuNgay=="${fromDate} 00:00:00";denNgay=="${toDate} 23:59:59";tenBenhNhan=="${safeName}"`;
    const records = [];
    let totalPages = 1;
    for(let page = 0; page < totalPages && page < 50; page++) {
      const url = new URL(PATIENT_LIST_ENDPOINT);
      url.searchParams.set("filter", filter);
      url.searchParams.set("page", String(page));
      url.searchParams.set("size", "50");
      url.searchParams.append("sort", "ngay");
      url.searchParams.append("sort", "desc");
      const payload = await fetchGatewayJson(url.href);
      if(payload?.code != null && Number(payload.code) !== 0)
        throw new Error(payload.message || "API danh sách khám bệnh báo lỗi.");
      const content = Array.isArray(payload?.data?.content) ? payload.data.content : [];
      records.push(...content);
      totalPages = Math.max(1, Number(payload?.data?.totalPages) || 1);
    }

    const matchedRecords = records.filter(record => {
      const patient = record?.benhNhan || {};
      return normalizePersonName(patient.tenBenhNhan) === expectedName &&
        normalizeBirthDate(patient.ngaySinh) === expectedBirthDate &&
        patientGender(patient) === expectedGender;
    });

    return Promise.all(matchedRecords.map(async record => {
      const patient = record.benhNhan || {};
      const tiepNhanId = String(record?.khamBenh?.tiepNhan?.id ?? "").trim();
      const base = {
        id:String(record.id ?? ""),
        tiepNhanId,
        patientId:String(patient.id ?? ""),
        patientCode:String(patient.maBenhNhan || ""),
        fullName:String(patient.tenBenhNhan || fullName),
        birthDate:displayBirthDate(patient.ngaySinh),
        gender:patientGender(patient),
        receptionDate:String(record.ngay || record?.khamBenh?.tiepNhan?.ngayTiepNhan || ""),
        identity:"",
        address:"",
        guardianName:"",
        guardianPhone:"",
        ethnicity:"",
        medicalRecordCode:String(record?.khamBenh?.hoSoBenhAn?.maHoSoBenhAn || "")
      };
      if(!/^\d+$/.test(tiepNhanId))
        return {...base, detailError:"Không có tiếpNhanId trong kết quả danh sách khám bệnh."};
      try {
        const detailUrl = new URL(PATIENT_DETAIL_ENDPOINT);
        detailUrl.searchParams.set("tiepNhanId", tiepNhanId);
        const detailPayload = await fetchGatewayJson(detailUrl.href);
        if(detailPayload?.code != null && Number(detailPayload.code) !== 0)
          throw new Error(detailPayload.message || "API thông tin bệnh nhân báo lỗi.");
        const detail = detailPayload?.data || {};
        return {
          ...base,
          patientCode:String(detail.maBenhNhan || base.patientCode),
          fullName:String(detail.tenBenhNhan || base.fullName),
          birthDate:displayBirthDate(detail.ngaySinh || base.birthDate),
          gender:String(detail.gioiTinh || base.gender),
          receptionDate:String(detail.ngayTiepNhan || base.receptionDate),
          identity:String(detail.soCMTND || ""),
          address:String(detail.diaChi || detail.soNha || ""),
          guardianName:String(detail.tenNguoiThan || ""),
          guardianPhone:String(detail.dienThoaiNguoiThan || ""),
          ethnicity:String(detail.tenDanToc || ""),
          medicalRecordCode:String(detail.maHoSoBenhAn || base.medicalRecordCode),
          roomName:String(detail.tenPhong || "")
        };
      } catch(error) {
        return {...base, detailError:error?.message || "Không lấy được thông tin chi tiết."};
      }
    }));
  };

  document.addEventListener("reception-check-existing-patient", event => {
    let request;
    try { request = JSON.parse(String(event.detail || "{}")); }
    catch { return; }
    const finish = result => document.dispatchEvent(new CustomEvent("reception-existing-patient-result", {
      detail:JSON.stringify({requestId:request.requestId, ...result})
    }));
    fetchExistingPatientMatches(request)
      .then(matches => finish({ok:true, matches}))
      .catch(error => finish({ok:false, error:error?.message || "Không gọi được API kiểm tra bệnh nhân."}));
  });

  window.fetch = function(input, init) {
    const requestUrl = typeof input === "string" || input instanceof URL ? input : input?.url;
    // Clone/read the Request before the native fetch consumes its stream. Newer
    // Angular fetch backends often pass a Request object and leave init undefined.
    const confirmBody = isConfirmUrl(requestUrl) ? readableRequestBody(input, init) : null;
    if(isGatewayUrl(requestUrl)) rememberFetchHeaders(input, init);
    const result = originalFetch(input, init);
    if(confirmBody) {
      result.then(response => {
        if(response.ok) confirmBody.then(announceConfirmedPatient).catch(() => {});
      }).catch(() => {});
    }
    if(isRegisterExamUrl(requestUrl)) {
      result.then(response => response.ok ? response.clone().json() : null)
        .then(payload => { if(payload) announceRegisteredPatient(payload); })
        .catch(() => {});
    }
    if(activePatientWatch()) {
      result.then(response => response.clone().text())
        .then(inspectPatientSearchText)
        .catch(() => {});
    }
    return result;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__receptionConfirmUrl = isConfirmUrl(url);
    this.__receptionRegisterExamUrl = isRegisterExamUrl(url);
    this.__receptionGatewayUrl = isGatewayUrl(url);
    return originalOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if(this.__receptionGatewayUrl) rememberGatewayHeader(name, value);
    return originalSetRequestHeader.call(this, name, value);
  };
  XMLHttpRequest.prototype.send = function(body) {
    if(this.__receptionConfirmUrl || this.__receptionRegisterExamUrl || activePatientWatch()) {
      this.addEventListener("load", () => {
        if(this.__receptionConfirmUrl && this.status >= 200 && this.status < 300)
          readableRequestBody(null, {body}).then(announceConfirmedPatient).catch(() => {});
        if(this.__receptionRegisterExamUrl && this.status >= 200 && this.status < 300) {
          try {
            const payload = this.responseType === "json" ? this.response : JSON.parse(this.responseText);
            announceRegisteredPatient(payload);
          } catch {}
        }
        if(activePatientWatch() && this.status >= 200 && this.status < 300) {
          try {
            if(this.responseType === "json") announcePatientIdFromResponse(this.response);
            else if(!this.responseType || this.responseType === "text") inspectPatientSearchText(this.responseText);
          } catch {}
        }
      }, {once:true});
    }
    return originalSend.call(this, body);
  };

  document.addEventListener("reception-open-health-exam", () => {
    armedUntil = Date.now() + 5000;
  });

  const healthExamUrl = value => {
    if(Date.now() > armedUntil || value == null) return null;
    const url = new URL(String(value), location.href);
    if(!url.pathname.endsWith("/new/his/ngoaitru/kb/cls/kham-lamsan")) return null;
    const id = url.searchParams.get("id");
    if(!id) return null;
    return `${url.origin}/new/his/ngoaitru/kb/cls/ksk-tre-duoi-6-tuoi?id=${encodeURIComponent(id)}`;
  };

  for(const method of ["pushState", "replaceState"]) {
    const original = history[method].bind(history);
    history[method] = function(state, title, url) {
      const target = healthExamUrl(url);
      if(target) {
        armedUntil = 0;
        location.assign(target);
        return;
      }
      return original(state, title, url);
    };
  }
})();
