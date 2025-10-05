/**
 * K8s 页面共享工具函数
 */

/**
 * 格式化时间为统一格式：2025/10/05 11:51:20
 * @param timeStr - 时间字符串（ISO 8601 格式或其他可解析格式）
 * @returns 格式化后的时间字符串
 */
export const formatK8sTime = (timeStr?: string | null): string => {
  if (!timeStr) return '-';
  
  try {
    const date = new Date(timeStr);
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return timeStr;
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return timeStr || '-';
  }
};

/**
 * 格式化 age 字段（存在时间）
 * 将类似 "5303h13m51.495736s" 的格式转换为 "221天5小时" 的友好格式
 * @param ageStr - age 字符串
 * @returns 格式化后的存在时间字符串
 */
export const formatK8sAge = (ageStr?: string | null): string => {
  if (!ageStr) return '-';
  
  // 解析类似 "5303h13m51.495736s" 的格式
  const hourMatch = ageStr.match(/(\d+)h/);
  const minuteMatch = ageStr.match(/(\d+)m/);
  const secondMatch = ageStr.match(/(\d+(?:\.\d+)?)s/);
  
  const hours = hourMatch && hourMatch[1] ? parseInt(hourMatch[1], 10) : 0;
  const minutes = minuteMatch && minuteMatch[1] ? parseInt(minuteMatch[1], 10) : 0;
  const seconds = secondMatch && secondMatch[1] ? parseFloat(secondMatch[1]) : 0;
  
  // 转换为更友好的格式
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  if (days > 0) {
    if (remainingHours > 0) {
      return `${days}天${remainingHours}小时`;
    }
    return `${days}天`;
  } else if (hours > 0) {
    if (minutes > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${hours}小时`;
  } else if (minutes > 0) {
    return `${minutes}分钟`;
  } else {
    return `${Math.floor(seconds)}秒`;
  }
};

/**
 * 格式化日期时间为标准格式：2025-10-05 11:51:20
 * @param dateStr - 日期时间字符串
 * @returns 格式化后的日期时间字符串
 */
export const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * 获取相对时间（多久之前）
 * @param dateStr - 日期时间字符串
 * @returns 相对时间字符串
 */
export const getRelativeTime = (dateStr: string): string => {
  if (!dateStr) return '';
  const now = new Date().getTime();
  const past = new Date(dateStr).getTime();
  const diff = now - past;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (years > 0) return `${years}年前`;
  if (months > 0) return `${months}个月前`;
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  if (seconds > 0) return `${seconds}秒前`;
  return '刚刚';
};

