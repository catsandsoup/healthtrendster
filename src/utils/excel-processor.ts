
import * as XLSX from 'xlsx';
import { DataPoint, Metric } from '@/types/blood-test';

export const processExcelData = (fileData: Uint8Array) => {
  try {
    const workbook = XLSX.read(fileData, {
      cellDates: true,
      cellStyles: true
    });
    
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const dates: Date[] = [];
    for (let col = 'C'.charCodeAt(0); col <= 'G'.charCodeAt(0); col++) {
      const cellRef = `${String.fromCharCode(col)}1`;
      if (sheet[cellRef]) {
        const dateValue = new Date(sheet[cellRef].v);
        if (!isNaN(dateValue.getTime())) {
          dates.push(dateValue);
        }
      }
    }

    // Sort dates in ascending order to ensure latest reading is at the end
    dates.sort((a, b) => a.getTime() - b.getTime());

    const params = new Set<string>();
    const testData: { [key: string]: { date: Date; value: number | undefined }[] } = {};
    const units: { [key: string]: string } = {};

    for (let row = 2; row <= 50; row++) {
      const paramCell = sheet[`A${row}`];
      const unitCell = sheet[`B${row}`];
      if (paramCell && paramCell.v && paramCell.v !== 'Unit') {
        const param = paramCell.v as string;
        params.add(param);
        units[param] = unitCell?.v || '';
        
        const paramData = dates.map((date, index) => {
          const colLetter = String.fromCharCode('C'.charCodeAt(0) + index);
          const cellValue = sheet[`${colLetter}${row}`]?.v;
          return { 
            date, 
            value: typeof cellValue === 'number' ? cellValue : undefined 
          };
        }).filter(data => data.value !== undefined);
        
        testData[param] = paramData;
      }
    }

    const chartData: DataPoint[] = dates.map((date, index) => {
      const dataPoint: DataPoint = { date };
      params.forEach(param => {
        const paramData = testData[param][index];
        if (paramData) {
          dataPoint[param] = paramData.value;
        }
      });
      return dataPoint;
    });

    const calculatedMetrics: Metric[] = Array.from(params).map(param => {
      const paramValues = testData[param];
      // Get the latest non-undefined value
      const latestValue = paramValues.length > 0 ? paramValues[paramValues.length - 1].value : undefined;
      // Get the second-to-last non-undefined value for trend calculation
      const previousValue = paramValues.length > 1 ? paramValues[paramValues.length - 2].value : undefined;
      
      const trend = latestValue !== undefined && previousValue !== undefined 
        ? latestValue - previousValue 
        : 0;
      
      console.log(`Parameter: ${param}, Latest Value: ${latestValue}, Previous Value: ${previousValue}, Trend: ${trend}`);
      
      return {
        name: param,
        value: latestValue !== undefined ? latestValue.toFixed(1) : 'N/A',
        unit: units[param],
        trend
      };
    });

    console.log('Processed Data:', { chartData, calculatedMetrics, dates });
    return {
      chartData,
      calculatedMetrics,
      parameters: Array.from(params)
    };
  } catch (error) {
    console.error('Error processing file:', error);
    throw new Error('Error processing file. Please make sure it matches the expected format.');
  }
};
