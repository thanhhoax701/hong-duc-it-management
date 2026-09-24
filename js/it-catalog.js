/* IT Catalog — dùng chung cho Hồng Đức IT Management.
   Firebase không bị thay đổi. File này chỉ chứa cấu hình danh mục và nội dung SOP.
*/
export const IT_CATALOG = {
  hardware: {
    key: 'hardware', label: 'PHẦN CỨNG', icon: '🧰',
    categories: [
      ['PC/Laptop','💻','Cài OS, driver, phần mềm; setup máy mới; thay RAM/SSD; xử lý lỗi thông thường.','Chuẩn hóa cấu hình; image; quản lý tập trung; phân tích lỗi diện rộng.'],
      ['Điện thoại','📱','Setup điện thoại; IP Phone/Analog; thay thiết bị; kiểm tra kết nối.','VoIP; SIP; IMS; quản lý tập trung; tích hợp hệ thống.'],
      ['Máy in','🖨','Driver; add printer; queue; toner; paper jam.','In Wi-Fi; managed print; chuẩn hóa và phân quyền.'],
      ['TV/Máy chiếu','📺','HDMI; setup TV; trình chiếu; lỗi cơ bản.','Quản lý tập trung; chuẩn hóa phòng họp; quản lý tín hiệu.'],
      ['Mạng cơ bản','🔌','Bấm/thay dây; tag label; bootcolor; kiểm tra kết nối.','Fiber; patch panel; rack; SFP; cable infrastructure.'],
      ['Rack','🗄','Patch dây; thay thiết bị; kiểm tra đèn/trạng thái; vệ sinh; label.','Power; cooling; capacity; redundancy; quy hoạch server room.'],
      ['Thiết bị','🖱','PC, webcam, headset, scanner, keyboard, mouse.','Chuẩn hóa; cấp phát/thu hồi; quản lý vòng đời.']
    ]
  },
  system: {
    key: 'system', label: 'HỆ THỐNG', icon: '⚙️',
    categories: [
      ['Tổng đài','☎️','IP Phone; extension; thay máy; kiểm tra cuộc gọi; lỗi đơn giản.','IP-PBX; SIP Trunk; IVR; Queue; Recording; VoIP VLAN; integration.'],
      ['Camera','📹','Lắp/thay camera; IP; PoE; mất kết nối; thay disk NVR.','CCTV; storage; VMS/NVR; camera network; retention; phân quyền.'],
      ['UPS/Power','🔋','Trạng thái; cảnh báo; battery; lỗi cơ bản.','Tính tải; thiết kế UPS; nguồn dự phòng; monitoring.'],
      ['Máy chấm công','🕒','User; vân tay/khuôn mặt; đồng bộ; xử lý kết nối.','Quản lý máy; API; database; đồng bộ hệ thống.']
    ]
  },
  server: {
    key: 'server', label: 'MÁY CHỦ', icon: '🖥️',
    categories: [
      ['Server','🖥','Kiểm tra trạng thái; restart service; thay linh kiện; cài OS; kiểm tra log.','AD/DNS/DHCP; virtualization; cluster; migration; HA; xử lý sự cố.'],
      ['Mạng','🌐','IP; Wi-Fi; ping; port; thay thiết bị theo cấu hình.','LAN/WAN; VLAN; routing; VPN; Wi-Fi system; redundancy.'],
      ['Firewall','🛡️','Trạng thái; rule có sẵn; mở port theo quy trình; kiểm tra kết nối.','Policy; NAT; VPN; HA; IDS/IPS; phân tích traffic.'],
      ['Storage/Backup','💾','Dung lượng; thay disk; backup job; restore.','RAID; NAS/SAN; snapshot; replication; backup strategy; DR.']
    ]
  }
};

export const IT_TICKET_STEPS = [
  'Tiếp nhận', 'Phân loại', 'Kiểm tra', 'Phân công', 'Xử lý', 'Kiểm tra lại', 'Ghi nhận', 'Hoàn tất'
];
