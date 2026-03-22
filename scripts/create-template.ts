import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';

// Crear un docx minimo con placeholders
// PizZip necesita un docx base. Creamos uno minimalista.

const TEMPLATE_DIR = path.join(process.cwd(), 'templates');

function createMinimalDocx(): Buffer {
  // Estructura minima de un .docx (es un ZIP con XML)
  const zip = new PizZip();

  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>'
  );

  zip.file('_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>'
  );

  zip.file('word/_rels/document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '</Relationships>'
  );

  const body = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>

<w:p><w:pPr><w:jc w:val="right"/></w:pPr>
<w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>{code_respuesta}</w:t></w:r></w:p>

<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>{fecha_respuesta}</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>Ingeniero.</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>[NOMBRE DESTINATARIO]</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>[CARGO DESTINATARIO]</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>[ENTIDAD]</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>[CIUDAD]</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>Ref.: </w:t></w:r>
<w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>{asunto}</w:t></w:r></w:p>

<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>Asunto: </w:t></w:r>
<w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>Respuesta al oficio {radicado} de fecha {fecha_documento}</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>Respetado ingeniero,</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>En atencion a su oficio con radicado {radicado} de fecha {fecha_documento}, recibido el {fecha_recepcion}, mediante el cual se formulan observaciones y solicitudes, nos permitimos dar respuesta en los siguientes terminos:</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>SOLICITUDES IDENTIFICADAS:</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>{solicitudes}</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>RESPUESTA:</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>[COMPLETAR RESPUESTA AQUI]</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>Cordialmente,</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>
<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>[NOMBRE DEL REMITENTE]</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>[CARGO]</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>[ENTIDAD]</w:t></w:r></w:p>

</w:body>
</w:document>`;

  zip.file('word/document.xml', body);

  return zip.generate({ type: 'nodebuffer' });
}

// Ejecutar
if (!fs.existsSync(TEMPLATE_DIR)) {
  fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
}

const templatePath = path.join(TEMPLATE_DIR, 'respuesta-template.docx');
const buffer = createMinimalDocx();
fs.writeFileSync(templatePath, buffer);
console.log(`Plantilla creada en: ${templatePath}`);
