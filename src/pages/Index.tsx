import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, TrendingUp, TrendingDown, Circle, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

interface HealthMetricCardProps {
  title: string;
  value: string | number;
  unit: string;
  trend: number;
  onClick: () => void;
  isSelected: boolean;
}

interface FileUploadProps {
  onFileUpload: (data: Uint8Array) => void;
}

interface DataPoint {
  date: Date;
  [key: string]: any;
}

interface Metric {
  name: string;
  value: string;
  unit: string;
  trend: number;
}

const HealthMetricCard: React.FC<HealthMetricCardProps> = ({ title, value, unit, trend, onClick, isSelected }) => (
  <div 
    onClick={onClick}
    className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
      isSelected ? 'bg-blue-50 border-2 border-blue-500' : 'bg-white border border-gray-200'
    }`}
  >
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-500">{title}</span>
      {trend > 0 ? (
        <TrendingUp className="w-4 h-4 text-green-500" />
      ) : trend < 0 ? (
        <TrendingDown className="w-4 h-4 text-red-500" />
      ) : (
        <Circle className="w-4 h-4 text-gray-400" />
      )}
    </div>
    <div className="mt-2">
      <span className="text-2xl font-semibold">{value}</span>
      <span className="ml-1 text-sm text-gray-500">{unit}</span>
    </div>
  </div>
);

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (result instanceof ArrayBuffer) {
          onFileUpload(new Uint8Array(result));
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="w-full p-8 border-2 border-dashed border-gray-300 rounded-xl text-center transition-colors duration-200 hover:border-gray-400"
    >
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileSelect}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg text-gray-600 font-medium">
          Drop your blood test file here
        </p>
        <p className="text-sm text-gray-500 mt-2">
          or click to upload
        </p>
        <p className="text-xs text-gray-400 mt-4">
          Supports Excel (.xlsx, .xls) and CSV files
        </p>
      </label>
    </div>
  );
};

const BloodTestDashboard: React.FC = () => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [parameters, setParameters] = useState<string[]>([]);
  const [selectedParameter, setSelectedParameter] = useState<string>('');
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [hasData, setHasData] = useState(false);

  const processExcelData = (fileData: Uint8Array) => {
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
          testData[param] = dates.map((date, index) => {
            const colLetter = String.fromCharCode('C'.charCodeAt(0) + index);
            const value = sheet[`${colLetter}${row}`]?.v;
            return { date, value: typeof value === 'number' ? value : undefined };
          });
        }
      }

      const chartData: DataPoint[] = dates.map((date, index) => {
        const dataPoint: DataPoint = { date };
        params.forEach(param => {
          dataPoint[param] = testData[param][index]?.value;
        });
        return dataPoint;
      });

      const calculatedMetrics: Metric[] = Array.from(params).map(param => {
        const values = testData[param].map(d => d.value).filter((v): v is number => v !== undefined);
        const latestValue = values[values.length - 1];
        const previousValue = values[values.length - 2];
        const trend = latestValue !== undefined && previousValue !== undefined ? latestValue - previousValue : 0;
        
        return {
          name: param,
          value: latestValue !== undefined ? latestValue.toFixed(1) : 'N/A',
          unit: units[param],
          trend
        };
      });

      setData(chartData);
      setParameters(Array.from(params));
      setSelectedParameter(Array.from(params)[0]);
      setMetrics(calculatedMetrics);
      setHasData(true);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing file. Please make sure it matches the expected format.');
    }
  };

  const formatDate = (date: Date): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', { 
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {!hasData ? (
        <FileUpload onFileUpload={processExcelData} />
      ) : (
        <>
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div className="flex items-center space-x-3">
              <Activity className="w-8 h-8 text-red-500" />
              <h1 className="text-2xl font-semibold">Blood Tests</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-500">Select Parameter:</span>
              <select
                value={selectedParameter}
                onChange={(e) => setSelectedParameter(e.target.value)}
                className="p-2 rounded-lg border border-gray-200 min-w-[200px] bg-white"
              >
                {parameters.map((param) => (
                  <option key={param} value={param}>{param}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <h2 className="text-lg font-medium">{selectedParameter}</h2>
                <div className="space-y-3">
                  <div>
                    <span className="text-gray-500 text-sm">Latest Reading</span>
                    <div className="text-2xl font-semibold">
                      {data[data.length - 1]?.[selectedParameter] || 'N/A'}
                      <span className="text-sm text-gray-500 ml-1">
                        {metrics.find(m => m.name === selectedParameter)?.unit}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 text-sm">Change</span>
                    <div className={`text-xl font-semibold ${
                      metrics.find(m => m.name === selectedParameter)?.trend > 0 
                        ? 'text-green-500' 
                        : metrics.find(m => m.name === selectedParameter)?.trend < 0 
                          ? 'text-red-500' 
                          : ''
                    }`}>
                      {metrics.find(m => m.name === selectedParameter)?.trend > 0 ? '+' : ''}
                      {metrics.find(m => m.name === selectedParameter)?.trend.toFixed(1) || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      stroke="#9CA3AF"
                    />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                      labelFormatter={(date: Date) => {
                        if (!date || !(date instanceof Date)) return '';
                        return date.toLocaleDateString('en-US', { 
                          month: 'long',
                          year: 'numeric'
                        });
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={selectedParameter}
                      stroke="#FF2D55"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#FF2D55' }}
                      activeDot={{ r: 6, fill: '#FF2D55' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {metrics.map((metric) => (
              <HealthMetricCard
                key={metric.name}
                title={metric.name}
                value={metric.value}
                unit={metric.unit}
                trend={metric.trend}
                isSelected={selectedParameter === metric.name}
                onClick={() => setSelectedParameter(metric.name)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BloodTestDashboard;
