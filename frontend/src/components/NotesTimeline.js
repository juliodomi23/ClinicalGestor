import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '../lib/utils';
import { CLINICAL_TAGS } from '../utils/mockData';
import { Plus, Clock, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const NotesTimeline = ({ notes = [], onAddNote, doctorName }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  const toggleTag = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = () => {
    if (!newNote.trim()) return;
    
    onAddNote?.({
      contenido: newNote,
      tags: selectedTags,
    });
    
    setNewNote('');
    setSelectedTags([]);
    setIsAdding(false);
  };

  const getTagInfo = (tagId) => {
    return CLINICAL_TAGS.find(t => t.id === tagId) || { label: tagId, color: 'bg-slate-500 text-white' };
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return format(date, "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es });
  };

  return (
    <Card className="bg-card border border-border/50 shadow-sm" data-testid="notes-timeline">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Notas Clínicas</CardTitle>
          {!isAdding && (
            <Button size="sm" onClick={() => setIsAdding(true)} data-testid="add-note-btn">
              <Plus className="h-4 w-4 mr-1" />
              Nueva Nota
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Add Note Form */}
        {isAdding && (
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3 animate-fade-in">
            <Textarea
              placeholder="Escribe la nota clínica aquí..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="min-h-[100px] resize-none"
              data-testid="note-textarea"
            />
            
            {/* Tags */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="h-4 w-4" />
                <span>Etiquetas:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {CLINICAL_TAGS.map(tag => (
                  <Badge
                    key={tag.id}
                    variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                    className={cn(
                      "cursor-pointer transition-all",
                      selectedTags.includes(tag.id) && tag.color
                    )}
                    onClick={() => toggleTag(tag.id)}
                    data-testid={`tag-${tag.id}`}
                  >
                    {tag.label}
                  </Badge>
                ))}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsAdding(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={!newNote.trim()} data-testid="save-note-btn">
                Guardar Nota
              </Button>
            </div>
          </div>
        )}
        
        {/* Timeline */}
        <div className="relative">
          {/* Timeline line */}
          {notes.length > 0 && (
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
          )}
          
          <div className="space-y-6">
            {notes.map((note, index) => (
              <div key={note.id} className="relative pl-12 animate-fade-in" data-testid={`note-${note.id}`}>
                {/* Timeline dot */}
                <div className="absolute left-3.5 top-0 w-3 h-3 rounded-full bg-primary border-2 border-card" />
                
                <div className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs bg-primary/20 text-primary">
                          {note.doctor_nombre?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{note.doctor_nombre}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDate(note.fecha)}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {note.contenido}
                  </p>
                  
                  {/* Tags */}
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {note.tags.map(tagId => {
                        const tag = getTagInfo(tagId);
                        return (
                          <Badge key={tagId} className={cn("text-xs", tag.color)}>
                            {tag.label}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {notes.length === 0 && !isAdding && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No hay notas clínicas registradas</p>
            <Button variant="link" size="sm" onClick={() => setIsAdding(true)} className="mt-2">
              Agregar primera nota
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
