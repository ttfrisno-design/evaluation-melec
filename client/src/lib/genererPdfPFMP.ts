import jsPDF from 'jspdf';
import { AttestationPFMP, ATTITUDES_PROFESSIONNELLES } from '@/lib/excelUtils';

export async function genererPdfPFMP(attestation: AttestationPFMP): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 10;

  // Couleurs
  const colorBlue = [25, 99, 235];
  const colorGreen = [34, 197, 94];
  const colorGray = [100, 100, 100];
  const colorLightGray = [240, 240, 240];

  // En-tête
  doc.setFillColor(colorBlue[0], colorBlue[1], colorBlue[2]);
  doc.rect(10, yPos, pageWidth - 20, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ATTESTATION DE PFMP', pageWidth / 2, yPos + 10, { align: 'center' });
  yPos += 20;

  // Texte intro
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const introText = `Conformément à l'article D. 124-9 du code de l'Éducation, une attestation de stage est délivrée par l'organisme d'accueil à tout élève.`;
  const introLines = doc.splitTextToSize(introText, pageWidth - 20);
  doc.text(introLines, 10, yPos);
  yPos += introLines.length * 5 + 5;

  // Fonction pour ajouter une section
  const addSection = (title: string, content: Array<[string, string]>) => {
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = 10;
    }

    doc.setFillColor(colorBlue[0], colorBlue[1], colorBlue[2]);
    doc.rect(10, yPos, pageWidth - 20, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 12, yPos + 5);
    yPos += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    content.forEach(([label, value]) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 10;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(label + ' :', 12, yPos);
      doc.setFont('helvetica', 'normal');
      const valueLines = doc.splitTextToSize(value || '', pageWidth - 50);
      doc.text(valueLines, 50, yPos);
      yPos += Math.max(5, valueLines.length * 4) + 2;
    });

    yPos += 3;
  };

  // L'entreprise
  addSection('L\'entreprise :', [
    ['Nom', attestation.entrepriseNom],
    ['Adresse', attestation.entrepriseAdresse],
    ['Représenté(e) par', attestation.entrepriseRepresentant],
    ['Fonction', attestation.entrepriseFonction],
  ]);

  // Élève
  addSection('Atteste que l\'élève désigné ci-dessous :', [
    ['Nom', attestation.eleveNom],
    ['Prénom', attestation.elevePrenom],
    ['Numéro candidat', attestation.eleveNumero],
    ['Classe', attestation.eleveClasse],
  ]);

  // Établissement
  addSection('Scolarisé dans l\'établissement ci-après :', [
    ['Nom', attestation.ecoleNom],
    ['Adresse', attestation.ecoleAdresse],
    ['Représenté par', attestation.ecoleRepresentant],
  ]);

  // Dates
  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = 10;
  }

  doc.setFillColor(colorGreen[0], colorGreen[1], colorGreen[2]);
  doc.rect(10, yPos, pageWidth - 20, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Période de formation :', 12, yPos + 5);
  yPos += 10;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const dateDebut = new Date(attestation.dateDebut || '').toLocaleDateString('fr-FR');
  const dateFin = new Date(attestation.dateFin || '').toLocaleDateString('fr-FR');

  doc.text(`Du ${dateDebut} au ${dateFin}`, 12, yPos);
  yPos += 6;
  doc.text(`Durée : ${attestation.dureeJours} jours`, 12, yPos);
  yPos += 10;

  // Attitudes professionnelles
  if (yPos > pageHeight - 50) {
    doc.addPage();
    yPos = 10;
  }

  doc.setFillColor(255, 193, 7);
  doc.rect(10, yPos, pageWidth - 20, 7, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Évaluation des attitudes professionnelles :', 12, yPos + 5);
  yPos += 10;

  doc.setFontSize(9);
  ATTITUDES_PROFESSIONNELLES.forEach((attitude) => {
    if (yPos > pageHeight - 15) {
      doc.addPage();
      yPos = 10;
    }

    doc.setFont('helvetica', 'bold');
    doc.text(attitude.nom, 12, yPos);
    doc.setFont('helvetica', 'normal');
    const note = attestation.attitudesProfessionnelles[attitude.id];
    doc.text(note ? `Note : ${note}/5` : 'Non évalué', 80, yPos);
    yPos += 6;
  });

  // Observations
  if (yPos > pageHeight - 30) {
    doc.addPage();
    yPos = 10;
  }

  yPos += 5;
  doc.setFillColor(220, 38, 38);
  doc.rect(10, yPos, pageWidth - 20, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Observations :', 12, yPos + 5);
  yPos += 10;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const obsLines = doc.splitTextToSize(attestation.observations || '', pageWidth - 20);
  doc.text(obsLines, 10, yPos);
  yPos += obsLines.length * 5 + 5;

  // Signature et tampon
  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = 10;
  }

  yPos += 5;
  doc.setFillColor(255, 235, 59);
  doc.rect(10, yPos, pageWidth - 20, 7, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Signature et tampon :', 12, yPos + 5);
  yPos += 12;

  // Signature
  if (attestation.signatureData) {
    try {
      doc.addImage(attestation.signatureData, 'png', 12, yPos, 40, 20);
      doc.text(`Signature (${attestation.signaturePad ? 'PAD' : 'Écran'})`, 12, yPos + 23);
    } catch (e) {
      doc.text('Signature : [Non disponible]', 12, yPos);
    }
  } else {
    doc.text('Signature : ___________________', 12, yPos);
  }

  // Tampon
  if (attestation.tamponPhoto) {
    try {
      doc.addImage(attestation.tamponPhoto, 'jpeg', pageWidth / 2 + 10, yPos, 40, 20);
      doc.text('Tampon de l\'entreprise', pageWidth / 2 + 10, yPos + 23);
    } catch (e) {
      doc.text('Tampon : [Non disponible]', pageWidth / 2 + 10, yPos);
    }
  } else {
    doc.text('Tampon : ___________________', pageWidth / 2 + 10, yPos);
  }

  // Date signature
  yPos += 30;
  doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 12, yPos);

  // Télécharger
  const filename = `Attestation_PFMP_${attestation.eleveNom}_${attestation.elevePrenom}.pdf`;
  doc.save(filename);
}
