// 仅收录仓库字符串图标实际用到的子集。
// 图标数据来自各自图标集：Lucide（ISC）、Carbon（Apache-2.0）、
// Material Design Icons（Apache-2.0）、Material Symbols（Apache-2.0）、
// Tabler（MIT）、Ant Design Icons（MIT）、Fluent（MIT）。
// carbon:check-mark / carbon:refresh / carbon:server 在当前 Carbon 集合中没有同名图标，
// 分别使用 checkmark / renew / bare-metal-server 的图形。carbon:checkmark 是页面实际使用的名称。
// carbon:user-off 没有同名图标，使用 user-minus（人像加一横，表示未安排人员）的图形。
export const offlineCollections = [
  {
    height: 1024,
    icons: {
      'info-circle-outlined': {
        body: '<path fill="currentColor" d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448s448-200.6 448-448S759.4 64 512 64m0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372s372 166.6 372 372s-166.6 372-372 372"/><path fill="currentColor" d="M464 336a48 48 0 1 0 96 0a48 48 0 1 0-96 0m72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8"/>',
      },
    },
    prefix: 'ant-design',
    width: 1024,
  },
  {
    height: 32,
    icons: {
      add: {
        body: '<path fill="currentColor" d="M17 15V8h-2v7H8v2h7v7h2v-7h7v-2z"/>',
      },
      'arrow-right': {
        body: '<path fill="currentColor" d="m18 6l-1.43 1.393L24.15 15H4v2h20.15l-7.58 7.573L18 26l10-10z"/>',
      },
      calendar: {
        body: '<path fill="currentColor" d="M26 4h-4V2h-2v2h-8V2h-2v2H6c-1.1 0-2 .9-2 2v20c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2m0 22H6V12h20zm0-16H6V6h4v2h2V6h8v2h2V6h4z"/>',
      },
      'calendar-heat-map': {
        body: '<path fill="currentColor" d="M26 4h-4V2h-2v2h-8V2h-2v2H6a2.003 2.003 0 0 0-2 2v20a2.003 2.003 0 0 0 2 2h20a2.003 2.003 0 0 0 2-2V6a2.003 2.003 0 0 0-2-2M6 6h4v2h2V6h8v2h2V6h4v4H6Zm0 6h5v6H6Zm13 14h-6v-6h6Zm0-8h-6v-6h6Zm2 8v-6h5l.001 6Z"/>',
      },
      'change-catalog': {
        body: '<path fill="currentColor" d="M24 24v2h2.46A5.94 5.94 0 0 1 22 28a6.007 6.007 0 0 1-6-6h-2a7.984 7.984 0 0 0 14 5.265V30h2v-6Zm-2-10a8.04 8.04 0 0 0-6 2.735V14h-2v6h6v-2h-2.46A5.94 5.94 0 0 1 22 16a6.007 6.007 0 0 1 6 6h2a8.01 8.01 0 0 0-8-8"/><path fill="currentColor" d="M12 28H6v-4h2v-2H6v-5h2v-2H6v-5h2V8H6V4h18v8h2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4H2v2h2v5H2v2h2v5H2v2h2v4a2 2 0 0 0 2 2h6Z"/>',
      },
      'check-mark': {
        body: '<path fill="currentColor" d="m13 24l-9-9l1.414-1.414L13 21.171L26.586 7.586L28 9z"/>',
      },
      checkmark: {
        body: '<path fill="currentColor" d="m13 24l-9-9l1.414-1.414L13 21.171L26.586 7.586L28 9z"/>',
      },
      'checkmark-filled': {
        body: '<path fill="currentColor" d="M16 2a14 14 0 1 0 14 14A14 14 0 0 0 16 2m-2 19.59l-5-5L10.59 15L14 18.41L21.41 11l1.596 1.586Z"/><path fill="none" d="m14 21.591l-5-5L10.591 15L14 18.409L21.41 11l1.595 1.585z"/>',
      },
      'checkmark-outline': {
        body: '<path fill="currentColor" d="m14 21.414l-5-5.001L10.413 15L14 18.586L21.585 11L23 12.415z"/><path fill="currentColor" d="M16 2a14 14 0 1 0 14 14A14 14 0 0 0 16 2m0 26a12 12 0 1 1 12-12a12 12 0 0 1-12 12"/>',
      },
      'chevron-left': {
        body: '<path fill="currentColor" d="M10 16L20 6l1.4 1.4l-8.6 8.6l8.6 8.6L20 26z"/>',
      },
      'chevron-right': {
        body: '<path fill="currentColor" d="M22 16L12 26l-1.4-1.4l8.6-8.6l-8.6-8.6L12 6z"/>',
      },
      'close-filled': {
        body: '<path fill="currentColor" d="M16 2C8.2 2 2 8.2 2 16s6.2 14 14 14s14-6.2 14-14S23.8 2 16 2m5.4 21L16 17.6L10.6 23L9 21.4l5.4-5.4L9 10.6L10.6 9l5.4 5.4L21.4 9l1.6 1.6l-5.4 5.4l5.4 5.4z"/>',
      },
      code: {
        body: '<path fill="currentColor" d="m31 16l-7 7l-1.41-1.41L28.17 16l-5.58-5.59L24 9zM1 16l7-7l1.41 1.41L3.83 16l5.58 5.59L8 23zm11.42 9.484L17.64 6l1.932.517L14.352 26z"/>',
      },
      'container-registry': {
        body: '<path fill="currentColor" d="M17 13V6H8v16h16v-9Zm-7-5h5v5h-5Zm0 7h5v5h-5Zm12 5h-5v-5h5Z"/><path fill="currentColor" d="M28 11h-9V2h9Zm-7-2h5V4h-5Zm7 11h-2v2h2v6H4v-6h2v-2H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2"/><circle cx="7" cy="25" r="1" fill="currentColor"/>',
      },
      'data-table': {
        body: '<path fill="currentColor" d="M8 18h4v2H8zm6 0h4v2h-4zm-6-4h4v2H8zm6 8h4v2h-4zm6-8h4v2h-4zm0 8h4v2h-4z"/><path fill="currentColor" d="M27 3H5a2.003 2.003 0 0 0-2 2v22a2.003 2.003 0 0 0 2 2h22a2.003 2.003 0 0 0 2-2V5a2.003 2.003 0 0 0-2-2m0 2v4H5V5ZM5 27V11h22v16Z"/>',
      },
      document: {
        body: '<path fill="currentColor" d="m25.7 9.3l-7-7c-.2-.2-.4-.3-.7-.3H8c-1.1 0-2 .9-2 2v24c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V10c0-.3-.1-.5-.3-.7M18 4.4l5.6 5.6H18zM24 28H8V4h8v6c0 1.1.9 2 2 2h6z"/><path fill="currentColor" d="M10 22h12v2H10zm0-6h12v2H10z"/>',
      },
      edit: {
        body: '<path fill="currentColor" d="M2 26h28v2H2zM25.4 9c.8-.8.8-2 0-2.8l-3.6-3.6c-.8-.8-2-.8-2.8 0l-15 15V24h6.4zm-5-5L24 7.6l-3 3L17.4 7zM6 22v-3.6l10-10l3.6 3.6l-10 10z"/>',
      },
      folder: {
        body: '<path fill="currentColor" d="m11.17 6l3.42 3.41l.58.59H28v16H4V6zm0-2H4a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2H16l-3.41-3.41A2 2 0 0 0 11.17 4"/>',
      },
      http: {
        body: '<path fill="currentColor" d="M30 11h-5v10h2v-3h3a2.003 2.003 0 0 0 2-2v-3a2 2 0 0 0-2-2m-3 5v-3h3l.001 3Zm-17-3h2v8h2v-8h2v-2h-6zm13-2h-6v2h2v8h2v-8h2zM6 11v4H3v-4H1v10h2v-4h3v4h2V11z"/>',
      },
      information: {
        body: '<path fill="currentColor" d="M17 22v-8h-4v2h2v6h-3v2h8v-2zM16 8a1.5 1.5 0 1 0 1.5 1.5A1.5 1.5 0 0 0 16 8"/><path fill="currentColor" d="M16 30a14 14 0 1 1 14-14a14 14 0 0 1-14 14m0-26a12 12 0 1 0 12 12A12 12 0 0 0 16 4"/>',
      },
      link: {
        body: '<path fill="currentColor" d="M29.25 6.76a6 6 0 0 0-8.5 0l1.42 1.42a4 4 0 1 1 5.67 5.67l-8 8a4 4 0 1 1-5.67-5.66l1.41-1.42l-1.41-1.42l-1.42 1.42a6 6 0 0 0 0 8.5A6 6 0 0 0 17 25a6 6 0 0 0 4.27-1.76l8-8a6 6 0 0 0-.02-8.48"/><path fill="currentColor" d="M4.19 24.82a4 4 0 0 1 0-5.67l8-8a4 4 0 0 1 5.67 0A3.94 3.94 0 0 1 19 14a4 4 0 0 1-1.17 2.85L15.71 19l1.42 1.42l2.12-2.12a6 6 0 0 0-8.51-8.51l-8 8a6 6 0 0 0 0 8.51A6 6 0 0 0 7 28a6.07 6.07 0 0 0 4.28-1.76l-1.42-1.42a4 4 0 0 1-5.67 0"/>',
      },
      'logo-kubernetes': {
        body: '<path fill="currentColor" d="m15.134 17.189l.865.416l.863-.415l.214-.931l-.597-.747h-.961l-.599.745zm-.917-3.309l.002.002a.524.524 0 0 0 .832-.401v-.003l.013-.007l.178-3.141q-.327.04-.633.11a6.2 6.2 0 0 0-2.973 1.617l2.575 1.826Zm-1.382 2.382h.003a.524.524 0 0 0 .206-.902l-.003-.002l.003-.012l-2.351-2.104a6.18 6.18 0 0 0-.875 3.9l3.014-.87Zm1.03 2.239a.523.523 0 0 0-.606-.399h-.004l-.005-.006l-3.09.525a6.2 6.2 0 0 0 2.486 3.11l1.197-2.893l-.009-.012l.001-.003a.5.5 0 0 0 .03-.322m2.597 1.142l-.001-.002a.53.53 0 0 0-.48-.276a.53.53 0 0 0-.444.277l-.001.003h-.003l-1.52 2.748a6.23 6.23 0 0 0 3.38.172q.312-.071.604-.168l-1.523-2.754Zm2.275-1.553h-.003a.5.5 0 0 0-.12-.009a.526.526 0 0 0-.455.732v.002l-.003.006l1.21 2.923a6.2 6.2 0 0 0 2.494-3.134l-3.118-.527Zm2.553-4.846l-2.339 2.092l.001.007l-.002.002a.525.525 0 0 0 .206.901h.003l.002.014l3.03.872a6.3 6.3 0 0 0-.902-3.888m-4.351.223v.003a.5.5 0 0 0 .115.304a.524.524 0 0 0 .719.097l.002-.002l.01.004l2.558-1.814a6.23 6.23 0 0 0-3.584-1.729l.177 3.136Z"/><path fill="currentColor" d="M30.38 19.038L27.903 8.27a1.9 1.9 0 0 0-1.038-1.292L16.83 2.19a1.93 1.93 0 0 0-1.666 0L5.133 6.982a1.9 1.9 0 0 0-1.038 1.29L1.619 19.04a1.9 1.9 0 0 0 .261 1.459a2 2 0 0 0 .109.151l6.944 8.634a1.92 1.92 0 0 0 1.5.716l11.135-.002a1.93 1.93 0 0 0 1.5-.715l6.942-8.635a1.9 1.9 0 0 0 .37-1.61m-3.81-.13a.643.643 0 0 1-.782.443h-.004l-.005-.001l-.007-.002l-.005-.002l-.057-.012l-.098-.022a2.5 2.5 0 0 1-.359-.132q-.085-.039-.18-.076l-.018-.006a5.5 5.5 0 0 0-1.028-.301a.4.4 0 0 0-.296.098l-.037.025l-.002.002h-.002l-.252-.045a7.82 7.82 0 0 1-3.459 4.351q.015.034.031.081a1 1 0 0 0 .067.157l.002.002l-.001.003l-.017.042a.42.42 0 0 0-.03.309a5.7 5.7 0 0 0 .533.951q.056.085.112.16a2.4 2.4 0 0 1 .21.32c.016.03.037.075.055.113l.023.049a.608.608 0 1 1-1.095.517l-.022-.045l-.052-.11a2.5 2.5 0 0 1-.121-.365q-.025-.09-.054-.185l-.006-.016a5.5 5.5 0 0 0-.405-.993a.42.42 0 0 0-.263-.17l-.041-.013h-.002l-.001-.002l-.06-.108l-.066-.12a8 8 0 0 1-1.027.31a7.76 7.76 0 0 1-4.51-.324l-.135.244l-.002.001a.5.5 0 0 0-.256.124a2.3 2.3 0 0 0-.336.721q-.058.177-.128.357a4 4 0 0 0-.054.188a2.5 2.5 0 0 1-.12.362l-.05.103l-.024.05v.002l-.002.002a.68.68 0 0 1-.595.394a.55.55 0 0 1-.24-.054a.643.643 0 0 1-.258-.86l.027-.058l.05-.104a2.5 2.5 0 0 1 .21-.322q.056-.075.112-.158a6 6 0 0 0 .543-.976a.6.6 0 0 0-.053-.336v-.004l.107-.257a7.82 7.82 0 0 1-3.46-4.32l-.26.044v-.001l-.027-.015a.6.6 0 0 0-.316-.106a5.6 5.6 0 0 0-1.028.301l-.017.007l-.178.073a2.5 2.5 0 0 1-.362.133c-.03.008-.07.017-.11.025l-.045.01l-.005.002l-.007.002h-.009a.608.608 0 1 1-.27-1.18h.005l.005-.002h.006l.046-.012c.04-.01.081-.02.114-.026a2.4 2.4 0 0 1 .38-.035q.096-.004.196-.011l.015-.002a5.6 5.6 0 0 0 1.062-.177a.7.7 0 0 0 .231-.227l.024-.032l.001-.001h.002l.247-.072a7.78 7.78 0 0 1 1.224-5.413l-.19-.17v-.002l-.004-.027a.6.6 0 0 0-.115-.316a5.6 5.6 0 0 0-.892-.627a4 4 0 0 0-.171-.094a2.5 2.5 0 0 1-.327-.197l-.09-.072l-.035-.028l-.005-.003l-.005-.004a.7.7 0 0 1-.26-.435a.57.57 0 0 1 .112-.457A.58.58 0 0 1 8 9.529a.72.72 0 0 1 .421.159l.037.028l.097.078a2.5 2.5 0 0 1 .267.276q.06.07.128.144l.01.01a5.5 5.5 0 0 0 .8.72a.42.42 0 0 0 .31.041l.042-.007h.002l.001.001c.036.026.149.107.214.151a7.73 7.73 0 0 1 3.923-2.24a8 8 0 0 1 1.082-.166l.014-.251V8.47a.65.65 0 0 0 .195-.308a5.6 5.6 0 0 0-.066-1.079l-.001-.008a4 4 0 0 0-.033-.192a3 3 0 0 1-.05-.38V6.4l.001-.05v-.017a.609.609 0 1 1 1.21 0l.002.06v.11a2.5 2.5 0 0 1-.05.38a4 4 0 0 0-.032.192l-.004.032a5.5 5.5 0 0 0-.064 1.056a.4.4 0 0 0 .162.267l.033.03l.002.001v.002c.001.044.008.184.013.264a7.8 7.8 0 0 1 2.718.756a7.9 7.9 0 0 1 2.263 1.65l.226-.161h.002l.031.002a.6.6 0 0 0 .33-.041a5.5 5.5 0 0 0 .787-.71l.022-.022q.067-.072.127-.142a3 3 0 0 1 .27-.278c.026-.023.062-.05.097-.078l.036-.029a.609.609 0 1 1 .755.948l-.044.035c-.03.026-.063.052-.088.071a2.5 2.5 0 0 1-.327.197q-.084.044-.173.095a5.7 5.7 0 0 0-.892.627a.42.42 0 0 0-.108.293l-.004.044v.001l-.001.001l-.091.082l-.119.107a7.8 7.8 0 0 1 1.25 5.4l.24.07h.001l.017.026a.6.6 0 0 0 .24.233a5.6 5.6 0 0 0 1.063.176h.012q.102.01.197.012a2.5 2.5 0 0 1 .38.035c.03.006.07.016.11.026l.064.015a.643.643 0 0 1 .512.74"/>',
      },
      'no-image': {
        body: '<path fill="currentColor" d="M30 3.414L28.586 2L2 28.586L3.414 30l2-2H26a2.003 2.003 0 0 0 2-2V5.414ZM26 26H7.414l7.793-7.793l2.379 2.379a2 2 0 0 0 2.828 0L22 19l4 3.997Zm0-5.832l-2.586-2.586a2 2 0 0 0-2.828 0L19 19.168l-2.377-2.377L26 7.414ZM6 22v-3l5-4.997l1.373 1.374l1.416-1.416l-1.375-1.375a2 2 0 0 0-2.828 0L6 16.172V6h16V4H6a2 2 0 0 0-2 2v16Z"/>',
      },
      notification: {
        body: '<path fill="currentColor" d="M28.707 19.293L26 16.586V13a10.014 10.014 0 0 0-9-9.95V1h-2v2.05A10.014 10.014 0 0 0 6 13v3.586l-2.707 2.707A1 1 0 0 0 3 20v3a1 1 0 0 0 1 1h7v.777a5.15 5.15 0 0 0 4.5 5.199A5.006 5.006 0 0 0 21 25v-1h7a1 1 0 0 0 1-1v-3a1 1 0 0 0-.293-.707M19 25a3 3 0 0 1-6 0v-1h6Zm8-3H5v-1.586l2.707-2.707A1 1 0 0 0 8 17v-4a8 8 0 0 1 16 0v4a1 1 0 0 0 .293.707L27 20.414Z"/>',
      },
      pause: {
        body: '<path fill="currentColor" d="M12 8v16H8V8zm0-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2m12 2v16h-4V8zm0-2h-4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2"/>',
      },
      play: {
        body: '<path fill="currentColor" d="M7 28a1 1 0 0 1-1-1V5a1 1 0 0 1 1.482-.876l20 11a1 1 0 0 1 0 1.752l-20 11A1 1 0 0 1 7 28M8 6.69v18.62L24.925 16Z"/>',
      },
      refresh: {
        body: '<path fill="currentColor" d="M12 10H6.78A11 11 0 0 1 27 16h2A13 13 0 0 0 6 7.68V4H4v8h8Zm8 12h5.22A11 11 0 0 1 5 16H3a13 13 0 0 0 23 8.32V28h2v-8h-8Z"/>',
      },
      send: {
        body: '<path fill="currentColor" d="m27.45 15.11l-22-11a1 1 0 0 0-1.08.12a1 1 0 0 0-.33 1L7 16L4 26.74A1 1 0 0 0 5 28a1 1 0 0 0 .45-.11l22-11a1 1 0 0 0 0-1.78m-20.9 10L8.76 17H18v-2H8.76L6.55 6.89L24.76 16Z"/>',
      },
      server: {
        body: '<circle cx="9" cy="6" r="1" fill="currentColor"/><path fill="currentColor" d="M26 10H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2M6 4v4h20V4Z"/><circle cx="9" cy="16" r="1" fill="currentColor"/><path fill="currentColor" d="M26 20H6a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2M6 14v4h20v-4Z"/><circle cx="9" cy="26" r="1" fill="currentColor"/><path fill="currentColor" d="M26 30H6a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2M6 24v4h20v-4Z"/>',
      },
      settings: {
        body: '<path fill="currentColor" d="M27 16.76v-1.53l1.92-1.68A2 2 0 0 0 29.3 11l-2.36-4a2 2 0 0 0-1.73-1a2 2 0 0 0-.64.1l-2.43.82a11 11 0 0 0-1.31-.75l-.51-2.52a2 2 0 0 0-2-1.61h-4.68a2 2 0 0 0-2 1.61l-.51 2.52a11.5 11.5 0 0 0-1.32.75l-2.38-.86A2 2 0 0 0 6.79 6a2 2 0 0 0-1.73 1L2.7 11a2 2 0 0 0 .41 2.51L5 15.24v1.53l-1.89 1.68A2 2 0 0 0 2.7 21l2.36 4a2 2 0 0 0 1.73 1a2 2 0 0 0 .64-.1l2.43-.82a11 11 0 0 0 1.31.75l.51 2.52a2 2 0 0 0 2 1.61h4.72a2 2 0 0 0 2-1.61l.51-2.52a11.5 11.5 0 0 0 1.32-.75l2.42.82a2 2 0 0 0 .64.1a2 2 0 0 0 1.73-1l2.28-4a2 2 0 0 0-.41-2.51ZM25.21 24l-3.43-1.16a8.9 8.9 0 0 1-2.71 1.57L18.36 28h-4.72l-.71-3.55a9.4 9.4 0 0 1-2.7-1.57L6.79 24l-2.36-4l2.72-2.4a8.9 8.9 0 0 1 0-3.13L4.43 12l2.36-4l3.43 1.16a8.9 8.9 0 0 1 2.71-1.57L13.64 4h4.72l.71 3.55a9.4 9.4 0 0 1 2.7 1.57L25.21 8l2.36 4l-2.72 2.4a8.9 8.9 0 0 1 0 3.13L27.57 20Z"/><path fill="currentColor" d="M16 22a6 6 0 1 1 6-6a5.94 5.94 0 0 1-6 6m0-10a3.91 3.91 0 0 0-4 4a3.91 3.91 0 0 0 4 4a3.91 3.91 0 0 0 4-4a3.91 3.91 0 0 0-4-4"/>',
      },
      table: {
        body: '<path fill="currentColor" d="M29 5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v22a2 2 0 0 0 2 2h22a2 2 0 0 0 2-2Zm-2 0v4H5V5Zm0 22H5v-4h22Zm0-6H5v-4h22Zm0-6H5v-4h22Z"/>',
      },
      task: {
        body: '<path fill="currentColor" d="m14 20.18l-3.59-3.59L9 18l5 5l9-9l-1.41-1.42z"/><path fill="currentColor" d="M25 5h-3V4a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v1H7a2 2 0 0 0-2 2v21a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2M12 4h8v4h-8Zm13 24H7V7h3v3h12V7h3Z"/>',
      },
      time: {
        body: '<path fill="currentColor" d="M16 30a14 14 0 1 1 14-14a14 14 0 0 1-14 14m0-26a12 12 0 1 0 12 12A12 12 0 0 0 16 4"/><path fill="currentColor" d="M20.59 22L15 16.41V7h2v8.58l5 5.01z"/>',
      },
      'tree-view': {
        body: '<path fill="currentColor" d="M30 20v-8h-8v3h-5V7a2 2 0 0 0-2-2h-5V2H2v8h8V7h5v18a2 2 0 0 0 2 2h5v3h8v-8h-8v3h-5v-8h5v3ZM8 8H4V4h4Zm16 16h4v4h-4Zm0-10h4v4h-4Z"/>',
      },
      upgrade: {
        body: '<path fill="currentColor" d="M21 24H11a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2m0 4H11v-2h10Zm7.707-13.707l-12-12a1 1 0 0 0-1.414 0l-12 12A1 1 0 0 0 4 16h5v4a2 2 0 0 0 2 2h10a2.003 2.003 0 0 0 2-2v-4h5a1 1 0 0 0 .707-1.707M21 14v6H11v-6H6.414L16 4.414L25.586 14Z"/>',
      },
      'user-activity': {
        body: '<path fill="currentColor" d="M25 23h-.021a1 1 0 0 1-.94-.726L20.87 11.19l-1.935 5.16A1 1 0 0 1 18 17h-4v-2h3.307l2.757-7.351a1 1 0 0 1 1.898.076l3.111 10.892l1.979-5.933A1 1 0 0 1 28 12h4v2h-3.28l-2.772 8.316A1 1 0 0 1 25 23m-10 7h-2v-7a3.003 3.003 0 0 0-3-3H6a3.003 3.003 0 0 0-3 3v7H1v-7a5.006 5.006 0 0 1 5-5h4a5.006 5.006 0 0 1 5 5ZM8 8a3 3 0 1 1-3 3a3 3 0 0 1 3-3m0-2a5 5 0 1 0 5 5a5 5 0 0 0-5-5"/>',
      },
      'user-admin': {
        body: '<path fill="currentColor" d="M12 4a5 5 0 1 1-5 5a5 5 0 0 1 5-5m0-2a7 7 0 1 0 7 7a7 7 0 0 0-7-7m10 28h-2v-5a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v5H2v-5a7 7 0 0 1 7-7h6a7 7 0 0 1 7 7Zm3-13.82l-2.59-2.59L21 15l4 4l7-7l-1.41-1.41z"/>',
      },
      'user-certification': {
        body: '<path fill="currentColor" d="m25 10l1.593 3l3.407.414l-2.5 2.253L28 19l-3-1.875L22 19l.5-3.333l-2.5-2.253L23.5 13zm-3 20h-2v-5a5.006 5.006 0 0 0-5-5H9a5.006 5.006 0 0 0-5 5v5H2v-5a7.01 7.01 0 0 1 7-7h6a7.01 7.01 0 0 1 7 7ZM12 4a5 5 0 1 1-5 5a5 5 0 0 1 5-5m0-2a7 7 0 1 0 7 7a7 7 0 0 0-7-7"/>',
      },
      'user-multiple': {
        body: '<path fill="currentColor" d="M30 30h-2v-5a5.006 5.006 0 0 0-5-5v-2a7.01 7.01 0 0 1 7 7Zm-8 0h-2v-5a5.006 5.006 0 0 0-5-5H9a5.006 5.006 0 0 0-5 5v5H2v-5a7.01 7.01 0 0 1 7-7h6a7.01 7.01 0 0 1 7 7ZM20 2v2a5 5 0 0 1 0 10v2a7 7 0 0 0 0-14m-8 2a5 5 0 1 1-5 5a5 5 0 0 1 5-5m0-2a7 7 0 1 0 7 7a7 7 0 0 0-7-7"/>',
      },
      'user-off': {
        body: '<path fill="currentColor" d="M22 30h-2v-5c0-2.757-2.243-5-5-5H9c-2.757 0-5 2.243-5 5v5H2v-5c0-3.86 3.14-7 7-7h6c3.86 0 7 3.14 7 7zm10-14H22v-2h10zm-20 0c-3.86 0-7-3.14-7-7s3.14-7 7-7s7 3.14 7 7s-3.14 7-7 7m0-12C9.243 4 7 6.243 7 9s2.243 5 5 5s5-2.243 5-5s-2.243-5-5-5"/>',
      },
      'user-online': {
        body: '<circle cx="26" cy="16" r="4" fill="currentColor"/><path fill="currentColor" d="M22 30h-2v-5a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v5H2v-5a7 7 0 0 1 7-7h6a7 7 0 0 1 7 7ZM12 4a5 5 0 1 1-5 5a5 5 0 0 1 5-5m0-2a7 7 0 1 0 7 7a7 7 0 0 0-7-7"/>',
      },
      warning: {
        body: '<path fill="currentColor" d="M16 2a14 14 0 1 0 14 14A14 14 0 0 0 16 2m0 26a12 12 0 1 1 12-12a12 12 0 0 1-12 12"/><path fill="currentColor" d="M15 8h2v11h-2zm1 14a1.5 1.5 0 1 0 1.5 1.5A1.5 1.5 0 0 0 16 22"/>',
      },
      'warning-alt': {
        body: '<path fill="currentColor" d="M16 23a1.5 1.5 0 1 0 1.5 1.5A1.5 1.5 0 0 0 16 23m-1-11h2v9h-2z"/><path fill="currentColor" d="M29 30H3a1 1 0 0 1-.887-1.461l13-25a1 1 0 0 1 1.774 0l13 25A1 1 0 0 1 29 30M4.65 28h22.7l.001-.003L16.002 6.17h-.004L4.648 27.997Z"/>',
      },
    },
    not_found: ['check-mark', 'refresh', 'server'],
    prefix: 'carbon',
    width: 32,
  },
  {
    height: 2048,
    icons: {
      'task-manager': {
        body: '<path fill="currentColor" d="M0 128h2048v1792H0zm1920 128H128v256h1792zM128 1792h1792V640H128zm128-640V768h384v384zm128-256v128h128V896zm-128 768v-384h384v384zm128-256v128h128v-128zm512-384V896h768v128zm0 512v-128h768v128z"/>',
      },
    },
    prefix: 'fluent-mdl2',
    width: 2048,
  },
  {
    aliases: {
      'alert-triangle': { parent: 'triangle-exclamation-point' },
      'badge-alert': { parent: 'badge-exclamation-point' },
      'shield-alert': { parent: 'shield-exclamation-point' },
      'trash-2': { parent: 'trash' },
    },
    height: 24,
    icons: {
      activity: {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
      },
      album: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M11 3v8l3-3l3 3V3"/></g>',
        hidden: true,
      },
      'area-chart': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 12v5h12V8l-5 5l-4-4Z"/></g>',
        hidden: true,
      },
      'badge-exclamation-point': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.85 8.62a4 4 0 0 1 4.78-4.77a4 4 0 0 1 6.74 0a4 4 0 0 1 4.78 4.78a4 4 0 0 1 0 6.74a4 4 0 0 1-4.77 4.78a4 4 0 0 1-6.75 0a4 4 0 0 1-4.78-4.77a4 4 0 0 1 0-6.76M12 8v4m0 4h.01"/>',
      },
      'bar-chart-3': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3v18h18m-3-4V9m-5 8V5M8 17v-3"/>',
        hidden: true,
      },
      bell: {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.268 21a2 2 0 0 0 3.464 0m-10.47-5.674A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
      },
      'bell-ring': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.268 21a2 2 0 0 0 3.464 0M22 8c0-2.3-.8-4.3-2-6M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326M4 2C2.8 3.7 2 5.7 2 8"/>',
      },
      book: {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
      },
      bot: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2m16 0h2m-7-1v2m-6-2v2"/></g>',
      },
      box: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7l8.7 5l8.7-5M12 22V12"/></g>',
      },
      boxes: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3zM7 16.5l-4.74-2.85M7 16.5l5-3m-5 3v5.17m5-8.17V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5zm5 3l-5-3m5 3l4.74-2.85M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3l5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0zM12 8L7.26 5.15M12 8l4.74-2.85M12 13.5V8"/></g>',
      },
      'chart-column': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3v16a2 2 0 0 0 2 2h16m-3-4V9m-5 8V5M8 17v-3"/>',
      },
      copy: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></g>',
      },
      database: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></g>',
      },
      download: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 15V3m9 12v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10l5 5l5-5"/></g>',
      },
      file: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/></g>',
      },
      'file-cog': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15 8a1 1 0 0 1-1-1V2a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8zm5 0v12a2 2 0 0 1-2 2h-4.182M3.305 19.53l.923-.382M4 10.592V4a2 2 0 0 1 2-2h8M4.228 16.852l-.924-.383m2.548-1.241l-.383-.923m.383 6.467l-.383.924m2.679-6.468l.383-.923m-.001 7.391l-.382-.924m1.625-3.92l.922-.383m-.922 2.679l.922.383"/><circle cx="7" cy="18" r="3"/></g>',
      },
      'file-search': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><circle cx="11.5" cy="14.5" r="2.5"/><path d="M13.3 16.3L15 18"/></g>',
      },
      'file-text': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5M10 9H8m8 4H8m8 4H8"/></g>',
      },
      folder: {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
      },
      gauge: {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m12 14l4-4M3.34 19a10 10 0 1 1 17.32 0"/>',
      },
      'git-branch': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15 6a9 9 0 0 0-9 9V3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/></g>',
      },
      'hard-drive': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 16h.01m-7.798-4.423a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zm19.734.436H2.054M6 16h.01"/>',
      },
      info: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></g>',
      },
      key: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m2 21l9.6-9.6m-4.1 4.1l2.3 2.3a1 1 0 0 1 0 1.4l-2.1 2.1a1 1 0 0 1-1.4 0L4 19"/><circle cx="15.5" cy="7.5" r="5.5"/></g>',
      },
      'key-round': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></g>',
      },
      layers: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></g>',
      },
      'layout-dashboard': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></g>',
      },
      lightbulb: {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 14c.2-1 .7-1.7 1.5-2.5c1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5c.7.7 1.3 1.5 1.5 2.5m0 4h6m-5 4h4"/>',
      },
      'list-check': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 5H3m13 7H3m8 7H3m12-1l2 2l4-4"/>',
      },
      'list-checks': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5h8m-8 7h8m-8 7h8M3 17l2 2l4-4M3 7l2 2l4-4"/>',
      },
      'list-tree': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 5h13m-8 7h8m-8 7h8M3 10a2 2 0 0 0 2 2h3"/><path d="M3 5v12a2 2 0 0 0 2 2h3"/></g>',
      },
      'message-circle': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092a10 10 0 1 0-4.777-4.719"/>',
      },
      'message-square': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>',
      },
      monitor: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8m-4-4v4"/></g>',
      },
      network: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="6" height="6" x="16" y="16" rx="1"/><rect width="6" height="6" x="2" y="16" rx="1"/><rect width="6" height="6" x="9" y="2" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3m-7-4V8"/></g>',
      },
      'package-check': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 22V12m4 5l2 2l4-4"/><path d="M21 11.127V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l1.32-.753"/><path d="M3.29 7L12 12l8.71-5M7.5 4.27l8.997 5.148"/></g>',
      },
      'package-search': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 22V12m8.27 6.27L22 20m-1-9.502V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l.98-.559"/><path d="M3.29 7L12 12l8.71-5M7.5 4.27l8.997 5.148"/><circle cx="18.5" cy="16.5" r="2.5"/></g>',
      },
      pencil: {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4"/>',
      },
      rocket: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"/><path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"/></g>',
      },
      'rotate-cw': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></g>',
      },
      route: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9 5h8.5a1 1 0 0 1 0 7h-11a1 1 0 0 0 0 7H15"/><circle cx="18" cy="19" r="3"/><circle cx="6" cy="5" r="3"/></g>',
      },
      search: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m21 21l-4.34-4.34"/><circle cx="11" cy="11" r="8"/></g>',
      },
      'send-horizontal': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904zM6 12h16"/>',
      },
      'separator-vertical': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v18m4-5l4-4l-4-4M8 8l-4 4l4 4"/>',
      },
      server: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><path d="M6 6h.01M6 18h.01"/></g>',
      },
      settings: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0a2.34 2.34 0 0 0 3.319 1.915a2.34 2.34 0 0 1 2.33 4.033a2.34 2.34 0 0 0 0 3.831a2.34 2.34 0 0 1-2.33 4.033a2.34 2.34 0 0 0-3.319 1.915a2.34 2.34 0 0 1-4.659 0a2.34 2.34 0 0 0-3.32-1.915a2.34 2.34 0 0 1-2.33-4.033a2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></g>',
      },
      shield: {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
      },
      'shield-check': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12l2 2l4-4"/></g>',
      },
      'shield-exclamation-point': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zm-8-5v4m0 4h.01"/>',
      },
      'sliders-horizontal': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 5H3m9 14H3M14 3v4m2 10v4m5-9h-9m9 7h-5m5-14h-7m-6 5v4m0-2H3"/>',
      },
      stethoscope: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M11 2v2M5 2v2m0-1H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/></g>',
      },
      terminal: {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19h8M4 17l6-6l-6-6"/>',
      },
      ticket: {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Zm11-4v2m0 10v2m0-8v2"/>',
      },
      trash: {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 11v6m4-6v6m5-11v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
      },
      'trending-up': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 7h6v6"/><path d="m22 7l-8.5 8.5l-5-5L2 17"/></g>',
      },
      'triangle-exclamation-point': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4m0 4h.01"/>',
      },
      user: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></g>',
      },
      'user-check': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m16 11l2 2l4-4m-6 12v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></g>',
      },
      'user-round-minus': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2 21a8 8 0 0 1 13.292-6"/><circle cx="10" cy="8" r="5"/><path d="M22 19h-6"/></g>',
      },
      users: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.128a4 4 0 0 1 0 7.744M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></g>',
      },
      workflow: {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/></g>',
      },
      wrench: {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
      },
      zap: {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z"/>',
      },
    },
    prefix: 'lucide',
    width: 24,
  },
  {
    height: 24,
    icons: {
      add: {
        body: '<path fill="currentColor" d="M11 13H5v-2h6V5h2v6h6v2h-6v6h-2z"/>',
      },
      'admin-panel-settings': {
        body: '<path fill="currentColor" d="M17 22q-2.075 0-3.537-1.463T12 17t1.463-3.537T17 12t3.538 1.463T22 17t-1.463 3.538T17 22m-5 0q-3.475-.875-5.738-3.988T4 11.1V5l8-3l8 3v5.675q-.65-.325-1.463-.5T17 10q-2.9 0-4.95 2.05T10 17q0 1.55.588 2.8t1.487 2.175q-.025 0-.037.013T12 22m6.063-5.437q.437-.438.437-1.063t-.437-1.062T17 14t-1.062.438T15.5 15.5t.438 1.063T17 17t1.063-.437M17 20q.775 0 1.425-.363t1.05-.962q-.55-.325-1.175-.5T17 18t-1.3.175t-1.175.5q.4.6 1.05.963T17 20"/>',
      },
      'badge-outline': {
        body: '<path fill="currentColor" d="M4 22q-.825 0-1.412-.587T2 20V9q0-.825.588-1.412T4 7h5V4q0-.825.588-1.412T11 2h2q.825 0 1.413.588T15 4v3h5q.825 0 1.413.588T22 9v11q0 .825-.587 1.413T20 22zm0-2h16V9h-5q0 .825-.587 1.413T13 11h-2q-.825 0-1.412-.587T9 9H4zm2-2h6v-.45q0-.425-.238-.788T11.1 16.2q-.5-.225-1.012-.337T9 15.75t-1.088.113T6.9 16.2q-.425.2-.663.563T6 17.55zm8-1.5h4V15h-4zm-3.937-1.937q.437-.438.437-1.063t-.437-1.062T9 12t-1.062.438T7.5 13.5t.438 1.063T9 15t1.063-.437M14 13.5h4V12h-4zM11 9h2V4h-2zm1 5.5"/>',
      },
      close: {
        body: '<path fill="currentColor" d="M6.4 19L5 17.6l5.6-5.6L5 6.4L6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4l-5.6-5.6z"/>',
      },
      delete: {
        body: '<path fill="currentColor" d="M7 21q-.825 0-1.412-.587T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.587 1.413T17 21zm2-4h2V8H9zm4 0h2V8h-2z"/>',
      },
      download: {
        body: '<path fill="currentColor" d="m12 16l-5-5l1.4-1.45l2.6 2.6V4h2v8.15l2.6-2.6L17 11zm-6 4q-.825 0-1.412-.587T4 18v-3h2v3h12v-3h2v3q0 .825-.587 1.413T18 20z"/>',
      },
      'keyboard-arrow-down': {
        body: '<path fill="currentColor" d="m12 15.4l-6-6L7.4 8l4.6 4.6L16.6 8L18 9.4z"/>',
      },
      person: {
        body: '<path fill="currentColor" d="M9.175 10.825Q8 9.65 8 8t1.175-2.825T12 4t2.825 1.175T16 8t-1.175 2.825T12 12t-2.825-1.175M4 20v-2.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2V20z"/>',
      },
      preview: {
        body: '<path fill="currentColor" d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h14q.825 0 1.413.588T21 5v14q0 .825-.587 1.413T19 21zm0-2h14V7H5zm3.338-3.113Q6.725 14.776 6 13q.725-1.775 2.338-2.887T12 9t3.663 1.113T18 13q-.725 1.775-2.337 2.888T12 17t-3.662-1.112m2.6-1.826Q10.5 13.626 10.5 13t.438-1.062T12 11.5t1.063.438T13.5 13t-.437 1.063T12 14.5t-1.062-.437m2.837.712Q14.5 14.05 14.5 13t-.725-1.775T12 10.5t-1.775.725T9.5 13t.725 1.775T12 15.5t1.775-.725"/>',
      },
      refresh: {
        body: '<path fill="currentColor" d="M12 20q-3.35 0-5.675-2.325T4 12t2.325-5.675T12 4q1.725 0 3.3.712T18 6.75V4h2v7h-7V9h4.2q-.8-1.4-2.187-2.2T12 6Q9.5 6 7.75 7.75T6 12t1.75 4.25T12 18q1.925 0 3.475-1.1T17.65 14h2.1q-.7 2.65-2.85 4.325T12 20"/>',
      },
      search: {
        body: '<path fill="currentColor" d="m19.6 21l-6.3-6.3q-.75.6-1.725.95T9.5 16q-2.725 0-4.612-1.888T3 9.5t1.888-4.612T9.5 3t4.613 1.888T16 9.5q0 1.1-.35 2.075T14.7 13.3l6.3 6.3zM9.5 14q1.875 0 3.188-1.312T14 9.5t-1.312-3.187T9.5 5T6.313 6.313T5 9.5t1.313 3.188T9.5 14"/>',
      },
      'search-off': {
        body: '<path fill="currentColor" d="M3.463 20.538Q2 19.075 2 17t1.463-3.537T7 12t3.538 1.463T12 17t-1.463 3.538T7 22t-3.537-1.463M20.6 21l-6.4-6.4q-.3-.325-.637-.662T12.9 13.3q.95-.6 1.525-1.6T15 9.5q0-1.875-1.312-3.187T10.5 5T7.313 6.313T6 9.5q0 .15.013.288t.037.287q-.45.05-.987.2t-.963.35q-.05-.275-.075-.55T4 9.5q0-2.725 1.888-4.612T10.5 3t4.613 1.888T17 9.5q0 1.075-.337 2.038t-.938 1.762L22 19.6zM5.225 19.475L7 17.7l1.75 1.775l.725-.7L7.7 17l1.775-1.775l-.7-.7L7 16.3l-1.775-1.775l-.7.7L6.3 17l-1.775 1.775z"/>',
      },
      'table-outline': {
        body: '<path fill="currentColor" d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h14q.825 0 1.413.588T21 5v14q0 .825-.587 1.413T19 21zm6-6H5v4h6zm2 0v4h6v-4zm-2-2V9H5v4zm2 0h6V9h-6zM5 7h14V5H5z"/>',
      },
      upload: {
        body: '<path fill="currentColor" d="M11 16V7.85l-2.6 2.6L7 9l5-5l5 5l-1.4 1.45l-2.6-2.6V16zm-5 4q-.825 0-1.412-.587T4 18v-3h2v3h12v-3h2v3q0 .825-.587 1.413T18 20z"/>',
      },
    },
    prefix: 'material-symbols',
    width: 24,
  },
  {
    height: 24,
    icons: {
      'alert-circle-outline': {
        body: '<path fill="currentColor" d="M11 15h2v2h-2zm0-8h2v6h-2zm1-5C6.47 2 2 6.5 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2m0 18a8 8 0 0 1-8-8a8 8 0 0 1 8-8a8 8 0 0 1 8 8a8 8 0 0 1-8 8"/>',
      },
      'alert-outline': {
        body: '<path fill="currentColor" d="M12 2L1 21h22M12 6l7.53 13H4.47M11 10v4h2v-4m-2 6v2h2v-2"/>',
      },
      'bell-off-outline': {
        body: '<path fill="currentColor" d="M22.11 21.46L2.39 1.73L1.11 3l4.72 4.72A7 7 0 0 0 5 11v6l-2 2v1h15.11l2.73 2.73zM7 18v-7c0-.61.11-1.21.34-1.77L16.11 18zm3 3h4a2 2 0 0 1-2 2a2 2 0 0 1-2-2M8.29 5.09c.53-.34 1.11-.59 1.71-.8V4a2 2 0 0 1 2-2a2 2 0 0 1 2 2v.29c2.97.88 5 3.61 5 6.71v4.8l-2-2V11a5 5 0 0 0-5-5c-.78 0-1.55.2-2.24.56z"/>',
      },
      'bell-ring-outline': {
        body: '<path fill="currentColor" d="M10 21h4a2 2 0 0 1-2 2a2 2 0 0 1-2-2m11-2v1H3v-1l2-2v-6c0-3.1 2.03-5.83 5-6.71V4a2 2 0 0 1 2-2a2 2 0 0 1 2 2v.29c2.97.88 5 3.61 5 6.71v6zm-4-8a5 5 0 0 0-5-5a5 5 0 0 0-5 5v7h10zm2.75-7.81l-1.42 1.42A8.98 8.98 0 0 1 21 11h2c0-2.93-1.16-5.75-3.25-7.81M1 11h2c0-2.4.96-4.7 2.67-6.39L4.25 3.19A10.96 10.96 0 0 0 1 11"/>',
      },
      'bug-outline': {
        body: '<path fill="currentColor" d="M20 8h-2.81c-.45-.8-1.07-1.5-1.82-2L17 4.41L15.59 3l-2.17 2.17a6 6 0 0 0-2.83 0L8.41 3L7 4.41L8.62 6c-.75.5-1.36 1.21-1.81 2H4v2h2.09c-.06.33-.09.66-.09 1v1H4v2h2v1c0 .34.03.67.09 1H4v2h2.81A5.99 5.99 0 0 0 15 20.18c.91-.52 1.67-1.28 2.19-2.18H20v-2h-2.09c.06-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.03-.67-.09-1H20zm-4 7a4 4 0 0 1-4 4a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4a4 4 0 0 1 4 4zm-2-5v2h-4v-2zm-4 4h4v2h-4z"/>',
      },
      'check-circle-outline': {
        body: '<path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10s10-4.5 10-10S17.5 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8m4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4l8-8z"/>',
      },
      'clipboard-check-outline': {
        body: '<path fill="currentColor" d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m-7 0a1 1 0 0 1 1 1a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1M7 7h10V5h2v14H5V5h2zm.5 6.5L9 12l2 2l4.5-4.5L17 11l-6 6z"/>',
      },
      cloud: {
        body: '<path fill="currentColor" d="M6.5 20q-2.28 0-3.89-1.57Q1 16.85 1 14.58q0-1.95 1.17-3.48q1.18-1.53 3.08-1.95q.63-2.3 2.5-3.72Q9.63 4 12 4q2.93 0 4.96 2.04Q19 8.07 19 11q1.73.2 2.86 1.5q1.14 1.28 1.14 3q0 1.88-1.31 3.19T18.5 20Z"/>',
      },
      'cloud-outline': {
        body: '<path fill="currentColor" d="M6.5 20q-2.28 0-3.89-1.57Q1 16.85 1 14.58q0-1.95 1.17-3.48q1.18-1.53 3.08-1.95q.63-2.3 2.5-3.72Q9.63 4 12 4q2.93 0 4.96 2.04Q19 8.07 19 11q1.73.2 2.86 1.5q1.14 1.28 1.14 3q0 1.88-1.31 3.19T18.5 20m-12-2h12q1.05 0 1.77-.73q.73-.72.73-1.77t-.73-1.77Q19.55 13 18.5 13H17v-2q0-2.07-1.46-3.54Q14.08 6 12 6Q9.93 6 8.46 7.46Q7 8.93 7 11h-.5q-1.45 0-2.47 1.03Q3 13.05 3 14.5T4.03 17q1.02 1 2.47 1m5.5-6"/>',
      },
      github: {
        body: '<path fill="currentColor" d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"/>',
      },
      google: {
        body: '<path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81"/>',
      },
      'hand-back-right-outline': {
        body: '<path fill="currentColor" d="M21 7a2.5 2.5 0 0 0-2.5-2.5c-.17 0-.34 0-.5.05V4a2.5 2.5 0 0 0-3.17-2.41A2.51 2.51 0 0 0 12.5 0c-1.23 0-2.25.89-2.46 2.06C9.87 2 9.69 2 9.5 2A2.5 2.5 0 0 0 7 4.5v5.89c-.34-.31-.76-.54-1.22-.66L5 9.5c-.82-.21-1.69.11-2.18.85c-.38.57-.4 1.31-.15 1.95l2.56 6.43A8.36 8.36 0 0 0 13 24c4.42 0 8-3.58 8-8zm-2 9c0 3.31-2.69 6-6 6a6.36 6.36 0 0 1-5.91-4L4.5 11.45l.5.14c.5.12.85.46 1 .91L7 15h2V4.5c0-.28.22-.5.5-.5s.5.22.5.5V12h2V2.5c0-.28.22-.5.5-.5s.5.22.5.5V12h2V4c0-.28.22-.5.5-.5s.5.22.5.5v8h2V7c0-.28.22-.5.5-.5s.5.22.5.5z"/>',
      },
      'home-outline': {
        body: '<path fill="currentColor" d="m12 5.69l5 4.5V18h-2v-6H9v6H7v-7.81zM12 3L2 12h3v8h6v-6h2v6h6v-8h3"/>',
      },
      'keyboard-esc': {
        body: '<path fill="currentColor" d="M1 7h6v2H3v2h4v2H3v2h4v2H1zm10 0h4v2h-4v2h2a2 2 0 0 1 2 2v2c0 1.11-.89 2-2 2H9v-2h4v-2h-2a2 2 0 0 1-2-2V9c0-1.1.9-2 2-2m8 0h2a2 2 0 0 1 2 2v1h-2V9h-2v6h2v-1h2v1c0 1.11-.89 2-2 2h-2a2 2 0 0 1-2-2V9c0-1.1.9-2 2-2"/>',
      },
      qqchat: {
        body: '<path fill="currentColor" d="M3.18 13.54c.58-1.38 1.39-2.4 1.99-2.62c-.01-.8.14-1.3.39-1.7c0-.03-.06-.36.16-.77C5.87 4.85 8.21 2 12 2s6.13 2.85 6.28 6.45c.22.41.16.74.16.77c.25.4.4.9.39 1.7c.6.22 1.41 1.24 1.99 2.63c.75 1.76.87 3.45.27 3.75c-.41.2-1.06-.3-1.67-1.18c-.24.98-.84 1.88-1.69 2.59c.9.33 1.48.87 1.48 1.48c0 1-1.58 1.81-3.52 1.81c-1.76 0-3.19-.66-3.48-1.5h-.42c-.29.84-1.72 1.5-3.48 1.5c-1.94 0-3.52-.81-3.52-1.81c0-.61.58-1.15 1.48-1.48c-.85-.71-1.45-1.61-1.69-2.59c-.61.88-1.26 1.38-1.67 1.18c-.6-.3-.48-1.99.27-3.76"/>',
      },
      'server-network': {
        body: '<path fill="currentColor" d="M13 19h1a1 1 0 0 1 1 1h7v2h-7a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1H2v-2h7a1 1 0 0 1 1-1h1v-2H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-7zM4 3h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1m5 4h1V5H9zm0 8h1v-2H9zM5 5v2h2V5zm0 8v2h2v-2z"/>',
      },
      wechat: {
        body: '<path fill="currentColor" d="M9.5 4C5.36 4 2 6.69 2 10c0 1.89 1.08 3.56 2.78 4.66L4 17l2.5-1.5c.89.31 1.87.5 2.91.5A5.2 5.2 0 0 1 9 14c0-3.31 3.13-6 7-6c.19 0 .38 0 .56.03C15.54 5.69 12.78 4 9.5 4m-3 2.5a1 1 0 0 1 1 1a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1m5 0a1 1 0 0 1 1 1a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1M16 9c-3.31 0-6 2.24-6 5s2.69 5 6 5c.67 0 1.31-.08 1.91-.25L20 20l-.62-1.87C20.95 17.22 22 15.71 22 14c0-2.76-2.69-5-6-5m-2 2.5a1 1 0 0 1 1 1a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1m4 0a1 1 0 0 1 1 1a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1"/>',
      },
    },
    prefix: 'mdi',
    width: 24,
  },
  {
    height: 24,
    icons: {
      'alert-circle-filled': {
        body: '<path fill="currentColor" d="M12 2c5.523 0 10 4.477 10 10a10 10 0 0 1-19.995.324L2 12l.004-.28C2.152 6.327 6.57 2 12 2m.01 13l-.127.007a1 1 0 0 0 0 1.986L12 17l.127-.007a1 1 0 0 0 0-1.986zM12 7a1 1 0 0 0-.993.883L11 8v4l.007.117a1 1 0 0 0 1.986 0L13 12V8l-.007-.117A1 1 0 0 0 12 7"/>',
      },
      'binary-tree-2': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 6a2 2 0 1 0-4 0a2 2 0 0 0 4 0m-7 8a2 2 0 1 0-4 0a2 2 0 0 0 4 0m14 0a2 2 0 1 0-4 0a2 2 0 0 0 4 0m-7 4a2 2 0 1 0-4 0a2 2 0 0 0 4 0M12 8v8m-5.684-3.504l4.368-4.992m7 4.992l-4.366-4.99"/>',
      },
      'clock-cog': {
        body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 12a9 9 0 1 0-9.002 9m5.003-2a2 2 0 1 0 4 0a2 2 0 1 0-4 0m2-3.5V17m0 4v1.5m3.031-5.25l-1.299.75m-3.463 2l-1.3.75m0-3.5l1.3.75m3.463 2l1.3.75"/><path d="M12 7v5l2 2"/></g>',
      },
      'cloud-network': {
        body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 20h7m4 0h7m-11 0a2 2 0 1 0 4 0a2 2 0 0 0-4 0m2-4v2m-4-1.996H6.657C4.085 16 2 13.993 2 11.517s2.085-4.482 4.657-4.482c.393-1.762 1.794-3.2 3.675-3.773c1.88-.572 3.956-.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486s-1.551 3.487-3.465 3.487H16"/>',
      },
    },
    prefix: 'tabler',
    width: 24,
  },
];
