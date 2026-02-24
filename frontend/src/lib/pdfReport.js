import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateMetricsReport = async (metrics, salesByMonth, offersByMonth, reviewsData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Título
  doc.setFontSize(20);
  doc.setTextColor(0, 82, 155);
  doc.text('Pró-Família Conecta', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(100);
  doc.text('Relatório de Métricas da Plataforma', pageWidth / 2, 30, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${currentDate}`, pageWidth / 2, 38, { align: 'center' });

  // Linha divisória
  doc.setDrawColor(0, 82, 155);
  doc.setLineWidth(0.5);
  doc.line(20, 42, pageWidth - 20, 42);

  // Seção 1: Resumo Geral
  doc.setFontSize(14);
  doc.setTextColor(0, 82, 155);
  doc.text('Resumo Geral', 20, 52);

  doc.setFontSize(11);
  doc.setTextColor(60);
  
  const summaryData = [
    ['Usuários Ativos (Aprovados)', metrics.approvedUsers?.toString() || '0'],
    ['Total de Usuários', metrics.totalUsers?.toString() || '0'],
    ['Ofertas Ativas', metrics.activeOffers?.toString() || '0'],
    ['Total de Ofertas', metrics.totalOffers?.toString() || '0'],
    ['Total de Avaliações', reviewsData.totalReviews?.toString() || '0'],
    ['Média das Avaliações', `${reviewsData.averageRating?.toFixed(1) || '0'} estrelas`],
  ];

  autoTable(doc, {
    startY: 56,
    head: [['Indicador', 'Valor']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [0, 82, 155], textColor: 255 },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 20, right: 20 }
  });

  // Seção 2: Vendas Reportadas
  let yPos = doc.lastAutoTable.finalY + 15;
  
  doc.setFontSize(14);
  doc.setTextColor(0, 82, 155);
  doc.text('Vendas Reportadas', 20, yPos);

  const salesSummary = [
    ['Vendas Aprovadas', metrics.salesApproved?.toString() || '0'],
    ['Vendas Pendentes', metrics.salesPending?.toString() || '0'],
    ['Vendas Rejeitadas', metrics.salesRejected?.toString() || '0'],
    ['Total de Vendas Reportadas', metrics.totalSalesReports?.toString() || '0'],
    ['Valor Total (Aprovadas)', `R$ ${(metrics.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
    ['Valor Médio por Venda', `R$ ${(metrics.averageSaleValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
  ];

  autoTable(doc, {
    startY: yPos + 4,
    head: [['Indicador', 'Valor']],
    body: salesSummary,
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129], textColor: 255 },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 20, right: 20 }
  });

  // Seção 3: Ofertas por Mês
  yPos = doc.lastAutoTable.finalY + 15;
  
  // Verificar se precisa de nova página
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(14);
  doc.setTextColor(0, 82, 155);
  doc.text('Ofertas Postadas por Mês', 20, yPos);

  if (offersByMonth && offersByMonth.length > 0) {
    autoTable(doc, {
      startY: yPos + 4,
      head: [['Mês/Ano', 'Quantidade de Ofertas']],
      body: offersByMonth.map(item => [item.monthYear, item.count.toString()]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 4 },
      margin: { left: 20, right: 20 }
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Nenhuma oferta registrada no período.', 25, yPos + 10);
  }

  // Seção 4: Vendas por Mês
  yPos = doc.lastAutoTable?.finalY + 15 || yPos + 20;
  
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(14);
  doc.setTextColor(0, 82, 155);
  doc.text('Vendas por Mês', 20, yPos);

  if (salesByMonth && salesByMonth.length > 0) {
    autoTable(doc, {
      startY: yPos + 4,
      head: [['Mês/Ano', 'Quantidade', 'Valor Total (R$)']],
      body: salesByMonth.map(item => [
        item.monthYear, 
        item.count.toString(),
        item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      ]),
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 4 },
      margin: { left: 20, right: 20 }
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Nenhuma venda registrada no período.', 25, yPos + 10);
  }

  // Rodapé
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Pró-Família Conecta - Relatório de Métricas | Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Salvar PDF
  const fileName = `relatorio-metricas-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
  
  return fileName;
};
