import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '../lib/utils';
import { TOOTH_STATES } from '../utils/mockData';
import { Info } from 'lucide-react';

// Tooth numbers for adult dentition
// Upper: 18-11 (right), 21-28 (left)
// Lower: 48-41 (right), 31-38 (left)
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];

const ZONES = ['vestibular', 'lingual', 'mesial', 'distal', 'oclusal'];

const ToothSVG = ({ number, data, onZoneClick, selectedState }) => {
  const getZoneState = (zona) => {
    return data?.zonas?.[zona] || 'sano';
  };

  const getZoneFill = (zona) => {
    const state = getZoneState(zona);
    return TOOTH_STATES[state]?.color || 'fill-white';
  };

  const isExtracted = Object.values(data?.zonas || {}).some(s => s === 'extraido');

  return (
    <div className="relative group">
      <svg
        viewBox="0 0 50 60"
        className={cn(
          "w-10 h-12 md:w-12 md:h-14",
          isExtracted && "opacity-30"
        )}
      >
        {/* Tooth outline */}
        <rect
          x="5"
          y="5"
          width="40"
          height="50"
          rx="5"
          className="fill-white stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="1"
        />
        
        {/* Vestibular (top) */}
        <rect
          x="10"
          y="8"
          width="30"
          height="10"
          rx="2"
          className={cn("tooth-zone stroke-slate-400 dark:stroke-slate-500 cursor-pointer", getZoneFill('vestibular'))}
          strokeWidth="0.5"
          onClick={() => onZoneClick?.(number, 'vestibular')}
        />
        
        {/* Mesial (left) */}
        <rect
          x="8"
          y="20"
          width="10"
          height="20"
          rx="2"
          className={cn("tooth-zone stroke-slate-400 dark:stroke-slate-500 cursor-pointer", getZoneFill('mesial'))}
          strokeWidth="0.5"
          onClick={() => onZoneClick?.(number, 'mesial')}
        />
        
        {/* Oclusal (center) */}
        <rect
          x="20"
          y="20"
          width="10"
          height="20"
          rx="2"
          className={cn("tooth-zone stroke-slate-400 dark:stroke-slate-500 cursor-pointer", getZoneFill('oclusal'))}
          strokeWidth="0.5"
          onClick={() => onZoneClick?.(number, 'oclusal')}
        />
        
        {/* Distal (right) */}
        <rect
          x="32"
          y="20"
          width="10"
          height="20"
          rx="2"
          className={cn("tooth-zone stroke-slate-400 dark:stroke-slate-500 cursor-pointer", getZoneFill('distal'))}
          strokeWidth="0.5"
          onClick={() => onZoneClick?.(number, 'distal')}
        />
        
        {/* Lingual (bottom) */}
        <rect
          x="10"
          y="42"
          width="30"
          height="10"
          rx="2"
          className={cn("tooth-zone stroke-slate-400 dark:stroke-slate-500 cursor-pointer", getZoneFill('lingual'))}
          strokeWidth="0.5"
          onClick={() => onZoneClick?.(number, 'lingual')}
        />
      </svg>
      
      {/* Tooth number */}
      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-medium text-muted-foreground">
        {number}
      </span>
    </div>
  );
};

export const Odontogram = ({ teethData = [], onUpdate, readOnly = false }) => {
  const [selectedState, setSelectedState] = useState('caries');
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);

  const getToothData = (number) => {
    return teethData.find(t => t.numero === number) || { numero: number, zonas: {} };
  };

  const handleZoneClick = (toothNumber, zone) => {
    if (readOnly) return;
    
    setSelectedTooth(toothNumber);
    setSelectedZone(zone);
    
    if (onUpdate) {
      onUpdate({
        diente_numero: toothNumber,
        zona: zone,
        estado: selectedState,
      });
    }
  };

  return (
    <Card className="bg-card border border-border/50 shadow-sm" data-testid="odontogram">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            Odontograma
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Info className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <p className="text-sm text-muted-foreground">
                  Haz clic en cada zona del diente para cambiar su estado. Selecciona primero el estado deseado de la leyenda.
                </p>
              </PopoverContent>
            </Popover>
          </CardTitle>
        </div>
        
        {/* State Legend / Selector */}
        {!readOnly && (
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(TOOTH_STATES).map(([key, { label, bgColor }]) => (
              <Button
                key={key}
                variant={selectedState === key ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  "text-xs h-7 gap-1.5",
                  selectedState === key && "ring-2 ring-offset-2"
                )}
                onClick={() => setSelectedState(key)}
                data-testid={`state-${key}`}
              >
                <span className={cn("w-3 h-3 rounded-full border", bgColor)} />
                {label}
              </Button>
            ))}
          </div>
        )}
        
        {readOnly && (
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(TOOTH_STATES).map(([key, { label, bgColor }]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("w-3 h-3 rounded-full border", bgColor)} />
                {label}
              </div>
            ))}
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6 overflow-x-auto pb-4">
          {/* Upper Teeth */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium text-center">Superior</div>
            <div className="flex justify-center">
              <div className="flex gap-1 border-r-2 border-dashed border-border pr-2 mr-2">
                {UPPER_RIGHT.map(num => (
                  <ToothSVG
                    key={num}
                    number={num}
                    data={getToothData(num)}
                    onZoneClick={handleZoneClick}
                    selectedState={selectedState}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                {UPPER_LEFT.map(num => (
                  <ToothSVG
                    key={num}
                    number={num}
                    data={getToothData(num)}
                    onZoneClick={handleZoneClick}
                    selectedState={selectedState}
                  />
                ))}
              </div>
            </div>
          </div>
          
          {/* Divider */}
          <div className="border-t border-dashed border-border" />
          
          {/* Lower Teeth */}
          <div className="space-y-2">
            <div className="flex justify-center">
              <div className="flex gap-1 border-r-2 border-dashed border-border pr-2 mr-2">
                {LOWER_RIGHT.map(num => (
                  <ToothSVG
                    key={num}
                    number={num}
                    data={getToothData(num)}
                    onZoneClick={handleZoneClick}
                    selectedState={selectedState}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                {LOWER_LEFT.map(num => (
                  <ToothSVG
                    key={num}
                    number={num}
                    data={getToothData(num)}
                    onZoneClick={handleZoneClick}
                    selectedState={selectedState}
                  />
                ))}
              </div>
            </div>
            <div className="text-xs text-muted-foreground font-medium text-center">Inferior</div>
          </div>
        </div>
        
        {selectedTooth && selectedZone && !readOnly && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
            <span className="font-medium">Última actualización:</span> Diente {selectedTooth}, zona {selectedZone} → {TOOTH_STATES[selectedState]?.label}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
