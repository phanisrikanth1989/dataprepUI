import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

/**
 * Export a job as a structured PDF document.
 * @param {Object} params
 * @param {Object} params.job - The job object { nodes, edges, nodeProperties, metadata, contextVariables }
 * @param {Object} params.registry - The component registry
 * @param {HTMLElement} params.canvasElement - The ReactFlow canvas DOM element for screenshot
 */
export async function exportJobAsPdf({ job, registry, canvasElement }) {
  const { nodes, edges, nodeProperties, metadata, contextVariables } = job;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  const accentColor = [74, 144, 217];
  const headerBg = [30, 41, 59];
  const altRowBg = [241, 245, 249];

  // ── Helper: add section title ──
  const addSectionTitle = (title) => {
    if (y > 260) { doc.addPage(); y = margin; }
    doc.setFillColor(...accentColor);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 4, y + 5.5);
    y += 12;
    doc.setTextColor(0, 0, 0);
  };

  // ── Helper: add key-value row ──
  const addKeyValue = (key, value) => {
    if (y > 275) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`${key}:`, margin + 2, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    const valStr = value !== undefined && value !== null && value !== '' ? String(value) : '—';
    doc.text(valStr, margin + 42, y);
    y += 5;
  };

  // ══════════════════════════════════════════════════════
  // PAGE 1: Header + Canvas Screenshot + Metadata
  // ══════════════════════════════════════════════════════

  // Title bar
  doc.setFillColor(...accentColor);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('DataPrep Studio — Job Report', margin, 14);
  y = 28;

  // Job name subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text(metadata.name || 'Untitled Job', margin, y);
  y += 4;
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + contentW, y);
  y += 6;

  // Canvas screenshot
  if (canvasElement) {
    try {
      const canvas = await html2canvas(canvasElement, {
        backgroundColor: '#0f172a',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const imgW = contentW;
      const imgH = (canvas.height / canvas.width) * imgW;
      const maxH = 90;
      const finalH = Math.min(imgH, maxH);
      doc.addImage(imgData, 'PNG', margin, y, imgW, finalH);
      y += finalH + 6;
    } catch {
      // Skip screenshot on error
    }
  }

  // Metadata
  addSectionTitle('Job Metadata');
  addKeyValue('Name', metadata.name);
  addKeyValue('Description', metadata.description);
  addKeyValue('Author', metadata.author);
  addKeyValue('Version', metadata.version);
  addKeyValue('Purpose', metadata.purpose);
  addKeyValue('Status', metadata.status);
  addKeyValue('Created', metadata.created);
  addKeyValue('Modified', metadata.modified);
  if (metadata.tags?.length > 0) {
    addKeyValue('Tags', metadata.tags.join(', '));
  }
  y += 4;

  // Summary stats
  addSectionTitle('Summary');
  addKeyValue('Total Components', nodes.length);
  addKeyValue('Total Connections', edges.length);
  addKeyValue('Context Variables', (contextVariables || []).length);
  // Count unique categories
  const cats = [...new Set(nodes.map((n) => n.data?.category || 'Other'))];
  addKeyValue('Categories Used', cats.join(', ') || '—');
  y += 4;

  // ══════════════════════════════════════════════════════
  // Components Table
  // ══════════════════════════════════════════════════════
  if (nodes.length > 0) {
    addSectionTitle('Components');

    const compRows = nodes.map((node, idx) => {
      const cType = node.data?.componentType || '';
      const def = registry[cType];
      return [
        idx + 1,
        node.data?.label || cType,
        cType,
        node.data?.category || '—',
        `(${Math.round(node.position?.x || 0)}, ${Math.round(node.position?.y || 0)})`,
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Label', 'Type', 'Category', 'Position']],
      body: compRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: headerBg, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: altRowBg },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 40 },
        2: { cellWidth: 50 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30 },
      },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ══════════════════════════════════════════════════════
  // Connections Table
  // ══════════════════════════════════════════════════════
  if (edges.length > 0) {
    if (y > 240) { doc.addPage(); y = margin; }
    addSectionTitle('Connections');

    const nodeMap = {};
    for (const n of nodes) {
      nodeMap[n.id] = n.data?.label || n.data?.componentType || n.id;
    }

    const edgeRows = edges.map((edge, idx) => [
      idx + 1,
      nodeMap[edge.source] || edge.source,
      nodeMap[edge.target] || edge.target,
      edge.label || '—',
      edge.data?.category || edge.type || '—',
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Source', 'Target', 'Label', 'Type']],
      body: edgeRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: headerBg, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: altRowBg },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ══════════════════════════════════════════════════════
  // Component Properties (per component)
  // ══════════════════════════════════════════════════════
  if (nodes.length > 0 && Object.keys(nodeProperties).length > 0) {
    if (y > 240) { doc.addPage(); y = margin; }
    addSectionTitle('Component Properties');

    for (const node of nodes) {
      const props = nodeProperties[node.id];
      if (!props) continue;

      const cType = node.data?.componentType || '';
      const def = registry[cType];
      const propEntries = Object.entries(props).filter(([k]) => !k.startsWith('__'));

      if (propEntries.length === 0) continue;

      if (y > 255) { doc.addPage(); y = margin; }

      // Component sub-header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...accentColor);
      doc.text(`${node.data?.label || cType} (${cType})`, margin + 2, y);
      y += 4;
      doc.setTextColor(0, 0, 0);

      const propRows = propEntries.map(([key, val]) => {
        const propDef = def?.properties?.find((p) => p.key === key);
        const label = propDef?.label || key;
        let displayVal = val;
        if (typeof val === 'object') {
          displayVal = JSON.stringify(val);
        }
        if (displayVal === '' || displayVal === undefined || displayVal === null) {
          displayVal = '—';
        }
        return [label, String(displayVal)];
      });

      autoTable(doc, {
        startY: y,
        margin: { left: margin + 4, right: margin },
        head: [['Property', 'Value']],
        body: propRows,
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: altRowBg },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' },
          1: { cellWidth: 'auto' },
        },
      });
      y = doc.lastAutoTable.finalY + 6;
    }
  }

  // ══════════════════════════════════════════════════════
  // Context Variables
  // ══════════════════════════════════════════════════════
  if (contextVariables && contextVariables.length > 0) {
    if (y > 240) { doc.addPage(); y = margin; }
    addSectionTitle('Context Variables');

    const ctxRows = contextVariables.map((cv, idx) => [
      idx + 1,
      cv.name || '—',
      cv.type || 'String',
      cv.value !== undefined ? String(cv.value) : '—',
      cv.comment || '—',
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Name', 'Type', 'Value', 'Comment']],
      body: ctxRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: headerBg, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: altRowBg },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Footer on every page ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    const pageH = doc.internal.pageSize.getHeight();
    doc.text(
      `DataPrep Studio — ${metadata.name || 'Job'} — Page ${i} of ${totalPages} — Generated ${new Date().toLocaleDateString()}`,
      margin,
      pageH - 6
    );
  }

  // Save
  const fileName = `${(metadata.name || 'Job').replace(/\s+/g, '_')}_Report.pdf`;
  doc.save(fileName);
}
