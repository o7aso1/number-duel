export async function shareResultImage(result: { title: string; score: number; attempts: number; outcome: string }) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080; canvas.height = 1080
  const context = canvas.getContext('2d')
  if (!context) return
  const gradient = context.createLinearGradient(0, 0, 1080, 1080)
  gradient.addColorStop(0, '#21173b'); gradient.addColorStop(1, '#0e6871')
  context.fillStyle = gradient; context.fillRect(0, 0, 1080, 1080)
  context.textAlign = 'center'; context.direction = 'rtl'
  context.fillStyle = '#f7ce66'; context.font = 'bold 68px sans-serif'; context.fillText('مبارزة الأرقام', 540, 170)
  context.fillStyle = '#ffffff'; context.font = 'bold 86px sans-serif'; context.fillText(result.title, 540, 330)
  context.fillStyle = '#f7ce66'; context.font = 'bold 150px monospace'; context.fillText(result.score.toLocaleString('en-US'), 540, 560)
  context.fillStyle = '#cfd8dc'; context.font = '44px sans-serif'; context.fillText(`النقاط · ${result.attempts} محاولة`, 540, 650)
  const cells = ['1','2','3','4']
  cells.forEach((value, index) => { const x = 320 + index * 145; context.fillStyle = 'rgba(255,255,255,.1)'; context.roundRect(x, 760, 110, 110, 24); context.fill(); context.fillStyle = '#ffffff'; context.font = 'bold 54px monospace'; context.fillText(value, x + 55, 835) })
  context.fillStyle = '#96e7dc'; context.font = '32px sans-serif'; context.fillText('هل تستطيع تحقيق نتيجة أفضل؟', 540, 970)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return
  const file = new File([blob], 'number-duel-result.png', { type: 'image/png' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ title: 'نتيجتي في مبارزة الأرقام', files: [file] }); return }
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
