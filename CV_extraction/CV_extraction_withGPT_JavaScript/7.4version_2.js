// npm install tesseract.js
// yarn add tesseract.js
// npm install pdf-poppler tesseract.js   (convert PDFs to PNGs.)
// npm install --save pdf2pic



// cd /Users/anothergreenday/Desktop/CV_hardskill_extraction_javascript
// node 7.4version_2.js



const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const LanguageDetect = require('languagedetect');
const ProgressBar = require('progress');
const csv = require('csv-parser');
const convert = require('pdf-poppler');



const ld = new LanguageDetect();


function escapeRegExp(string) {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// Extract the hard skills from the second column of the CSV file
const hardSkills = [];

function loadSkills() {
  return new Promise((resolve, reject) => {
    fs.createReadStream('Hardskill.csv')
      .pipe(csv())
      .on('data', (row) => {
          hardSkills.push(row.label.trim());
      })
      .on('end', () => {
        resolve();
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

// to run the functions, and make them in order, run loadskills first, then processFolder
loadSkills().then(() => {
    processFolder('/Users/anothergreenday/Desktop/CV_hardskill_extraction_javascript/80_CV');
  }).catch((err) => {
    console.error(`Failed to load skills from CSV: ${err.message}`);
  });


// function to extract the text, if statement:if cannot be extracted by package then use OCR
async function extractTextFromPDF(file) {
    try {
        const dataBuffer = fs.readFileSync(file);
        const data = await pdfParse(dataBuffer);

        // If there is no text extracted, try OCR
        if (data.text === null || data.text.trim().length === 0) {
            console.log(`No text extracted from ${file}. Attempting OCR.`);
            const text = await extractTextFromPDFWithOCR(file);
            return text;
        }

        return data.text;
    } catch (e) {
        console.error(`Failed to process file ${file}: ${e.message}`);
        
        // If there is an error, try OCR
        try {
            console.log(`${file}. Attempting OCR.`);
            const text = await extractTextFromPDFWithOCR(file);
            return text;
        } catch (e) {
            console.error(`Failed to process file ${file} with OCR: ${e.message}`);
            return null;
        }
    }
}

// the OCR function, need to fill in the language of the file
async function extractTextFromPDFWithOCR(file) {
    // Convert PDF to PNG
    let opts = {
        format: 'png',
        out_dir: path.dirname(file),
        out_prefix: path.basename(file, path.extname(file)),
        page: null
    }
    let filePaths = await convert.convert(file, opts);
    
    // Process the first page only
    let result = await Tesseract.recognize(filePaths[0], 'fre', { logger: m => console.log(m) });
    return result.data.text;
}
    


async function processFolder(folder) {
    const files = fs.readdirSync(folder);
    const csvData = [];
    const failedFiles = [];
    const bar = new ProgressBar(':bar :current/:total', { total: files.length });

    for (const file of files) {
        const filePath = path.join(folder, file);

        // use package to extract the text
        const text = await extractTextFromPDF(filePath);


        // to detect the languages
        // const detectedLangs = ld.detect(text);
        // const lang = detectedLangs.shift()[0];

        // regex search
        const extractedSkills = hardSkills.filter(skill => {
            const escapedSkill = escapeRegExp(skill);
            // const regex = new RegExp(`\\b${escapedSkill}\\b`, 'i'); // Use \b for word boundary
            const regex = new RegExp(`\\b(?<![\\w.@])${escapedSkill}\\b(?![@\\w])`, 'g'); //this regex is to solve the .com problem
            return regex.test(text);
        });


        // write into a csv 
        csvData.push({
            file: file,
            text: text,
            // lang: lang,
            hardSkills: extractedSkills.join(", ")
        });

        bar.tick();
    }

    await csvWriter.writeRecords(csvData);
    console.log('The CSV file was written successfully');

    if (failedFiles.length > 0) {
        console.log('Failed to process the following files:');
        for (const file of failedFiles) {
            console.log(file);
        }
    }
}

// output the csv
const csvWriter = createCsvWriter({
    path: 'out.csv',
    header: [
        { id: 'file', title: 'FILE' },
        { id: 'text', title: 'TEXT' },
        // { id: 'lang', title: 'LANGUAGE' },
        { id: 'hardSkills', title: 'HARD_SKILLS' },
    ]
});


