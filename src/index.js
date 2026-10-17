function greet() {
    return "Xin chào quý công dân! Chào mừng đến với hệ thống dịch vụ công trực tuyến thành phố";
}

function guide() {
    return "Vui lòng chọn dịch vụ bạn quan tâm:";
}

function showServices() {
    return [
        "1. Đăng ký thường trú/tạm trú",
        "2. Cấp giấy phép xây dựng",
        "3. Đăng ký khai sinh",
        "4. Đóng bảo hiểm xã hội",
        "5. Cấp đổi giấy phép lái xe",
        "6. Đăng ký kết hôn"
    ];
}

function getServiceDetails(serviceId) {
    if (typeof serviceId !== 'number' || !Number.isInteger(serviceId) || serviceId < 1) {
        return "Dịch vụ không tồn tại";
    }
    const details = {
        1: "Thủ tục đăng ký hộ khẩu thường trú/tạm trú",
        2: "Thủ tục xin cấp phép xây dựng công trình",
        3: "Đăng ký khai sinh cho trẻ em",
        4: "Thanh toán bảo hiểm xã hội điện tử",
        5: "Đổi giấy phép lái xe qua mạng",
        6: "Đăng ký kết hôn trực tuyến"
    };
    return details[serviceId] || "Dịch vụ không tồn tại";
}

function runService(serviceId) {
    if (typeof serviceId !== 'number' || !Number.isInteger(serviceId) || serviceId < 1) {
        return {
            status: "thất bại",
            message: "ID dịch vụ không hợp lệ",
            timestamp: new Date().toISOString(),
            serviceId: serviceId
        };
    }
    return {
        status: "thành công",
        message: `Đang xử lý dịch vụ số ${serviceId}: ${getServiceDetails(serviceId)}`,
        timestamp: new Date().toISOString(),
        serviceId: serviceId
    };
}

module.exports = {
    greet,
    guide,
    showServices,
    getServiceDetails,
    runService
};
