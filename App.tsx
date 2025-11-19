import React, { useState, useEffect, useMemo } from 'react';
import { Appointment, Recording, DialogueTurn } from './types';
import Recorder from './components/Recorder';
import { generateGoogleCalendarUrl } from './services/calendar';
import { analyzeAudio } from './services/gemini';

const App: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const saved = localStorage.getItem('medical_appointments');
    return saved ? JSON.parse(saved) : [];
  });
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
  
  // Form State
  const [formState, setFormState] = useState({
    title: '',
    doctorName: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    location: '',
    notes: ''
  });

  useEffect(() => {
    localStorage.setItem('medical_appointments', JSON.stringify(appointments));
  }, [appointments]);

  const activeAppointment = useMemo(() => 
    appointments.find(a => a.id === activeAppointmentId),
    [appointments, activeAppointmentId]
  );

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const newAppointment: Appointment = {
      id: crypto.randomUUID(),
      ...formState,
      recordings: [],
      createdAt: Date.now()
    };
    setAppointments(prev => [newAppointment, ...prev]);
    setFormState({
        title: '',
        doctorName: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        location: '',
        notes: ''
    });
    setActiveAppointmentId(newAppointment.id);
    setView('detail');
  };

  const handleRecordingComplete = async (base64Audio: string, mimeType: string) => {
    if (!activeAppointmentId) return;

    const newRecording: Recording = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      audioData: base64Audio,
      mimeType,
      isProcessing: true
    };

    // Update state optimistically
    setAppointments(prev => prev.map(app => {
      if (app.id === activeAppointmentId) {
        return { ...app, recordings: [newRecording, ...app.recordings] };
      }
      return app;
    }));

    // Trigger Analysis
    try {
      const result = await analyzeAudio(base64Audio, mimeType);
      
      setAppointments(prev => prev.map(app => {
        if (app.id === activeAppointmentId) {
          const updatedRecordings = app.recordings.map(rec => {
            if (rec.id === newRecording.id) {
              return {
                ...rec,
                isProcessing: false,
                transcript: result.transcript,
                summary: result.summary
              };
            }
            return rec;
          });
          return { ...app, recordings: updatedRecordings };
        }
        return app;
      }));
    } catch (error) {
      setAppointments(prev => prev.map(app => {
        if (app.id === activeAppointmentId) {
          const updatedRecordings = app.recordings.map(rec => {
            if (rec.id === newRecording.id) {
              return {
                ...rec,
                isProcessing: false,
                error: "Failed to analyze audio. Please try again."
              };
            }
            return rec;
          });
          return { ...app, recordings: updatedRecordings };
        }
        return app;
      }));
    }
  };

  const deleteAppointment = (id: string) => {
      setAppointments(prev => prev.filter(a => a.id !== id));
      if (activeAppointmentId === id) {
          setView('list');
          setActiveAppointmentId(null);
      }
  };

  // Helper to render transcript content
  const renderTranscript = (transcript: string | DialogueTurn[]) => {
    if (Array.isArray(transcript)) {
      return (
        <div className="space-y-4">
          {transcript.map((turn, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  turn.speaker.toLowerCase().includes('doctor') ? 'text-teal-700' : 
                  turn.speaker.toLowerCase().includes('patient') ? 'text-blue-600' : 'text-slate-500'
                }`}>
                  {turn.speaker}
                </span>
              </div>
              <p className="text-slate-700 leading-relaxed pl-0">{turn.text}</p>
            </div>
          ))}
        </div>
      );
    }
    
    // Fallback for legacy string transcripts
    return (
       <div>
        {(transcript as string).split('\n').map((line, i) => (
            <p key={i} className="mb-2">{line}</p>
        ))}
       </div>
    );
  };

  return (
    <div className="min-h-screen bg-teal-50/50 text-slate-900 flex flex-col md:flex-row">
      {/* Sidebar / Navigation */}
      <aside className={`w-full md:w-80 bg-white border-r border-teal-100 flex-shrink-0 flex flex-col h-screen ${view === 'list' ? 'block' : 'hidden md:block'}`}>
        <div className="p-6 border-b border-teal-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                </svg>
             </div>
             <h1 className="font-serif text-lg font-bold text-teal-900">Medical Notebook</h1>
          </div>
          <button 
            onClick={() => setView('create')}
            className="p-2 text-teal-600 hover:bg-teal-50 rounded-full transition-colors"
            title="New Appointment"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {appointments.length === 0 && (
                <div className="text-center text-slate-400 mt-10">
                    <p className="text-sm">No appointments yet.</p>
                    <button onClick={() => setView('create')} className="text-teal-600 hover:underline text-sm mt-2 font-medium">Add your first visit</button>
                </div>
            )}
          {appointments.map(app => (
            <div 
              key={app.id}
              onClick={() => { setActiveAppointmentId(app.id); setView('detail'); }}
              className={`p-4 rounded-xl cursor-pointer transition-all hover:shadow-md border ${activeAppointmentId === app.id ? 'bg-teal-50 border-teal-200 ring-1 ring-teal-200' : 'bg-white border-slate-100 shadow-sm'}`}
            >
              <h3 className="font-semibold text-slate-800 truncate">{app.title}</h3>
              <p className="text-xs font-medium text-teal-600 mt-0.5 truncate">
                 {app.doctorName ? `Dr. ${app.doctorName}` : 'No provider listed'}
              </p>
              <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 opacity-70">
                  <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                </svg>
                <span>{new Date(app.date).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto bg-teal-50/30 p-4 md:p-8">
        
        {/* Mobile Back Button */}
        {view !== 'list' && (
            <button onClick={() => setView('list')} className="md:hidden mb-4 flex items-center text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-1">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
                Back to List
            </button>
        )}

        {view === 'create' && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-2xl font-serif font-bold text-teal-900 mb-6">New Medical Appointment</h2>
            <form onSubmit={handleCreateAppointment} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Appointment Type / Reason</label>
                    <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                    placeholder="e.g., Annual Physical, Dermatology Checkup"
                    value={formState.title}
                    onChange={e => setFormState({...formState, title: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Doctor / Provider Name</label>
                    <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                    placeholder="e.g., Dr. Smith, LabCorp"
                    value={formState.doctorName}
                    onChange={e => setFormState({...formState, doctorName: e.target.value})}
                    />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input 
                    required
                    type="date" 
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                    value={formState.date}
                    onChange={e => setFormState({...formState, date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                  <input 
                    required
                    type="time" 
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                    value={formState.time}
                    onChange={e => setFormState({...formState, time: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Clinic Location</label>
                <div className="relative">
                  <input 
                    type="text" 
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                    placeholder="e.g., 123 Main St, Suite 200"
                    value={formState.location}
                    onChange={e => setFormState({...formState, location: e.target.value})}
                  />
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 absolute left-3 top-2.5 text-slate-400">
                    <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.006.004.003.001a.75.75 0 01-.01-1.498.75.75 0 01.01 1.498zM10 13a4 4 0 100-8 4 4 0 000 8z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Symptoms / Questions to Ask</label>
                <textarea 
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition-all h-24 resize-none"
                  placeholder="List any symptoms, current medications, or questions for the doctor..."
                  value={formState.notes}
                  onChange={e => setFormState({...formState, notes: e.target.value})}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setView('list')}
                  className="px-6 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-sm shadow-teal-200 transition-all"
                >
                  Save Appointment
                </button>
              </div>
            </form>
          </div>
        )}

        {view === 'detail' && activeAppointment && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-teal-100">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-xs font-bold uppercase tracking-wide mb-2">
                     Medical Appointment
                  </span>
                  <h1 className="text-3xl font-serif font-bold text-slate-900 mb-1">{activeAppointment.title}</h1>
                  <p className="text-xl text-teal-700 font-medium mb-3">Dr. {activeAppointment.doctorName}</p>
                  
                  <div className="space-y-1 text-slate-600">
                    <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-slate-400">
                            <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">
                            {new Date(activeAppointment.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span>{activeAppointment.time}</span>
                    </div>
                    {activeAppointment.location && (
                         <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-slate-400">
                                <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.006.004.003.001a.75.75 0 01-.01-1.498.75.75 0 01.01 1.498zM10 13a4 4 0 100-8 4 4 0 000 8z" clipRule="evenodd" />
                            </svg>
                            <span>{activeAppointment.location}</span>
                        </div>
                    )}
                  </div>
                  {activeAppointment.notes && (
                      <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                          <span className="font-bold text-slate-700 block text-xs uppercase tracking-wider mb-1">Symptoms / History</span>
                          <p className="text-slate-600">{activeAppointment.notes}</p>
                      </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <a 
                    href={generateGoogleCalendarUrl(activeAppointment)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all text-sm font-medium whitespace-nowrap"
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M12.75 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM7.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM8.25 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM9.75 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM10.5 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM12.75 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM14.25 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 13.5a.75.75 0 100-1.5.75.75 0 000 1.5z" />
                        <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
                    </svg>
                    Add to Google Calendar
                  </a>
                  <button 
                    onClick={() => deleteAppointment(activeAppointment.id)}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            {/* Recorder Section */}
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-teal-100">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-6 bg-teal-500 rounded-full"></span>
                    Record Consultation
                </h2>
                <p className="text-slate-500 text-sm mb-4">Record the conversation with your doctor. Gemini will transcribe it and provide a clinical summary.</p>
                <Recorder onRecordingComplete={handleRecordingComplete} />
            </div>

            {/* Recordings Feed */}
            <div className="space-y-6">
                {activeAppointment.recordings.map((recording, idx) => (
                    <div key={recording.id} className="bg-white rounded-2xl shadow-sm border border-teal-100 overflow-hidden">
                         <div className="bg-teal-50/50 border-b border-teal-50 px-6 py-3 flex justify-between items-center">
                            <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">Session {activeAppointment.recordings.length - idx}</span>
                            <span className="text-xs text-slate-400">{new Date(recording.timestamp).toLocaleString()}</span>
                        </div>
                        
                        <div className="p-6 md:p-8 space-y-6">
                            {/* Processing State */}
                            {recording.isProcessing && (
                                <div className="flex flex-col items-center justify-center py-8 text-teal-600 animate-pulse">
                                    <svg className="animate-spin h-8 w-8 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="font-medium">Generating clinical summary...</span>
                                </div>
                            )}

                            {/* Error State */}
                            {recording.error && (
                                <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                                    {recording.error}
                                </div>
                            )}

                            {/* Results */}
                            {recording.summary && (
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-teal-600">
                                            <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456c0 .356.82 1.544 2 1.544q.21 0 .403-.015a6.002 6.002 0 00-1.828-12.051 6 6 0 001.425 12.066c.618 0 1.697-.313 2.336-.938C14.323 13.143 15 11.542 15 9.945c0-3.859-2.239-7.938-5-8.945z" />
                                        </svg>
                                        Appointment Summary
                                    </h3>
                                    <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 text-slate-700 leading-relaxed whitespace-pre-wrap">
                                        {recording.summary}
                                    </div>
                                </div>
                            )}

                            {recording.transcript && (
                                <div>
                                     <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-400">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM6.75 9.25a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                                        </svg>
                                        Full Transcript
                                    </h3>
                                    <div className="bg-white p-4 rounded-lg border border-slate-100 max-h-96 overflow-y-auto">
                                        {renderTranscript(recording.transcript)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}

        {view === 'list' && appointments.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                <div className="w-24 h-24 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 mb-4 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Medical Notebook</h2>
                <p className="text-slate-500 max-w-md">Keep track of your doctor visits, record consultations, and let AI generate clinical summaries and action plans for you.</p>
                <button 
                  onClick={() => setView('create')}
                  className="px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-full font-medium shadow-lg shadow-teal-200 transition-all transform hover:-translate-y-1"
                >
                  Add New Appointment
                </button>
             </div>
        )}
      </main>
    </div>
  );
};

export default App;