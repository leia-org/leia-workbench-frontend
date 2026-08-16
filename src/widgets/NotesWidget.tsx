import { Rnd } from "react-rnd";
import { useState, useEffect } from "react";

interface NoteEntry {
  text: string;
  sessionId: string;
}

const Notes = () => {
  // 1. Capturamos el sessionId al montar el componente para que no sea alterado por otras pestañas
  const [sessionId] = useState(() => localStorage.getItem("sessionId"));

  // 2. Modificamos el estado inicial para usar el sessionId que acabamos de capturar
  const [text, setText] = useState(() => {
    if (!sessionId) return "";
    const raw = localStorage.getItem("notes");
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw);
      const found = parsed.find((note: NoteEntry) => note.sessionId === sessionId);
      return found ? found.text : "";
    } catch {
      return "";
    }
  });

  function getAllNotes(): NoteEntry[] {
    const raw = localStorage.getItem("notes");
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  useEffect(() => {
    if (!sessionId) return;

    const timeout = setTimeout(() => {
      const notes = getAllNotes();
      
      // Usamos el sessionId del estado, NO el de localStorage directamente
      const index = notes.findIndex((note) => note.sessionId === sessionId);

      if (index !== -1) {
        notes[index].text = text;
      } else {
        notes.push({
          text,
          sessionId,
        });
      }

      localStorage.setItem("notes", JSON.stringify(notes));
    }, 4000);

    return () => {
      clearTimeout(timeout);
    };
  }, [text, sessionId]); 

  return (
    <Rnd
      default={{
        x: 16,
        y: 64,
        width: 320,
        height: 200,
      }}
      minWidth={200}
      minHeight={100}
      dragHandleClassName="notes-drag-handle"
      style={{ zIndex: 60 }}
      className="rounded-lg border border-gray-300 bg-white shadow-lg overflow-hidden"
    >
      <div className="flex flex-col h-full w-full">
        <div className="notes-drag-handle cursor-move bg-gray-100 border-b border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 select-none flex-shrink-0">
          Notes
        </div>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
          className="
            w-full
            h-full
            flex-1
            resize-none
            border-none
            outline-none
            p-3
            text-sm
            bg-transparent
          "
          placeholder="Write your notes here..."
        />
      </div>
    </Rnd>
  );
};

export default Notes;