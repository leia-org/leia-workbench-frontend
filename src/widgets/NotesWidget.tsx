import { Rnd } from "react-rnd";
import { useState, useEffect } from "react";

interface NoteEntry {
  text: string;
  sessionId: string;
}


const Notes = () => {
  const [text, setText] = useState(getNoteForSession() || "");

    function getAllNotes(): NoteEntry[] {
    const raw = localStorage.getItem("notes");
    console.log("Notes toggled:")
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
    }
    function getNoteForSession(): string | null {
    const notes = getAllNotes();
    return notes.find(note => note.sessionId === localStorage.getItem("sessionId"))?.text || null;
    }
    useEffect(() => {
    const timeout = setTimeout(() => {
    const notes = getAllNotes();
    const sessionId = localStorage.getItem("sessionId");

            if (!sessionId) return;

            const index = notes.findIndex(
            note => note.sessionId === sessionId
            );

            if (index !== -1) {
            notes[index].text = text;
            } else {
            notes.push({
                text,
                sessionId
            });
            }

            localStorage.setItem(
            "notes",
            JSON.stringify(notes)
            );

        }, 4000);

        // funcion de limpieza para q se resetee la funcion cada vez q escribe
        return () => {
            clearTimeout(timeout);
        };
        }, [text]);
    

  return (
    <Rnd
      default={{
        x: 150,
        y: 150,
        width: 320,
        height: 200,
      }}
      minWidth={200}
      minHeight={100}
      dragHandleClassName="notes-drag-handle"
      className="rounded-lg border border-gray-300 bg-white shadow-lg overflow-hidden z-49"
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