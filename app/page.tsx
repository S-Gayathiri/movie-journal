'use client';

import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

interface Movie {
  id: number;
  name: string;
  date: string;
  theatre: string;
  rating: string;
  memory: string;
  media_url?: string;
}

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'stats'>('timeline');
  const [isAdding, setIsAdding] = useState(false);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Expanded year stats accordion state (e.g. tracks which year is open in the stats tab)
  const [expandedYearStats, setExpandedYearStats] = useState<number | null>(null);

  // Form states (Add & Edit)
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [theatre, setTheatre] = useState('');
  const [rating, setRating] = useState('4.9 ⭐');
  const [memory, setMemory] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const isSpecialDay = true;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchMovies();
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchMovies();
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchMovies() {
    try {
      const { data, error } = await supabase.from('movies').select('*');
      if (error) throw error;
      if (data) {
        const sorted = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setMovies(sorted);
      }
    } catch (err) {
      console.error('Error fetching movies:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const formatHumanDate = (dateString: string) => {
    if (!dateString) return '';
    if (!dateString.includes('-')) return dateString;
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      if (months[monthIndex]) {
        return `${day} ${months[monthIndex]} ${year}`;
      }
    }
    return dateString;
  };

  const startEditing = (movie: Movie) => {
    setEditingMovie(movie);
    setName(movie.name);
    setDate(movie.date.includes('-') ? movie.date : '');
    setTheatre(movie.theatre);
    setRating(movie.rating);
    setMemory(movie.memory);
    setFile(null);
  };

  const handleDeleteMovie = async (id: number) => {
    if (!confirm('Are you sure you want to delete this movie memory?')) return;

    try {
      const { error } = await supabase
        .from('movies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMovies(movies.filter((m) => m.id !== id));
      setEditingMovie(null);
      setSelectedMovie(null);
    } catch (err: any) {
      alert(`Failed to delete: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleUpdateMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMovie || !name || !date || !theatre) return;

    setUploading(true);
    let mediaUrl = editingMovie.media_url;

    try {
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('movie-media')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('movie-media')
          .getPublicUrl(fileName);

        mediaUrl = publicData.publicUrl;
      }

      const formattedRating = rating.includes('⭐') ? rating : `${rating} ⭐`;
      const updatedData = {
        name,
        date,
        theatre,
        rating: formattedRating,
        memory,
        media_url: mediaUrl
      };

      const { error } = await supabase
        .from('movies')
        .update(updatedData)
        .eq('id', editingMovie.id);

      if (error) throw error;

      const savedMovie: Movie = {
        id: editingMovie.id,
        name,
        date,
        theatre,
        rating: formattedRating,
        memory,
        media_url: mediaUrl
      };

      const updatedMovies = movies
        .map((m) => (m.id === editingMovie.id ? savedMovie : m))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setMovies(updatedMovies);
      setSelectedMovie(savedMovie);
      setEditingMovie(null);
      setFile(null);
    } catch (err: any) {
      alert(`Failed to update: ${err?.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAddMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !date || !theatre) return;

    setUploading(true);
    let mediaUrl = '';

    try {
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('movie-media')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('movie-media')
          .getPublicUrl(fileName);

        mediaUrl = publicData.publicUrl;
      }

      const formattedRating = rating.includes('⭐') ? rating : `${rating} ⭐`;

      const newMovieData = {
        name,
        date,
        theatre,
        rating: formattedRating,
        memory: memory || "Another magical movie memory together.",
        media_url: mediaUrl || null
      };

      const { data, error } = await supabase.from('movies').insert([newMovieData]).select();
      if (error) throw error;
      if (data) {
        const updated = [...movies, data[0]].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setMovies(updated);
      }

      setIsAdding(false);
      setName('');
      setDate('');
      setTheatre('');
      setRating('4.9 ⭐');
      setMemory('');
      setFile(null);
    } catch (err: any) {
      alert(`Failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  // Dynamic stats calculations
  const totalMemories = movies.length;
  let daysSinceFirst = 0;
  if (movies.length > 0) {
    const firstMovieDate = new Date(movies[0].date).getTime();
    const today = new Date().getTime();
    const diffTime = Math.abs(today - firstMovieDate);
    daysSinceFirst = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  let averageRating = '5.0';
  if (movies.length > 0) {
    const sum = movies.reduce((acc, m) => {
      const num = parseFloat(m.rating);
      return acc + (isNaN(num) ? 5.0 : num);
    }, 0);
    averageRating = (sum / movies.length).toFixed(1);
  }

  if (loading) {
    return <main className="min-h-screen bg-[#141414] text-[#F5F2EB] p-6 flex items-center justify-center font-serif tracking-wide animate-fadeIn">Opening our journal...</main>;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#141414] text-[#F5F2EB] p-6 flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-6 animate-fadeIn">
        <div className="bg-[#1C1C1C]/90 backdrop-blur-md border border-[#2D2D2D]/60 p-8 rounded-[24px] shadow-2xl w-full space-y-5">
          <h1 className="text-3xl font-serif font-normal text-[#F5F2EB] tracking-wide">❤️ Movie Journal</h1>
          <p className="text-[#A8A59F] text-sm font-sans leading-relaxed">Every movie tells our story. Please sign in to open our journal.</p>
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-[#F5F2EB] text-[#141414] font-medium py-3.5 px-4 rounded-[16px] hover:bg-white transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer shadow-md text-sm font-sans"
          >
            <span>🔐</span> Sign in with Google
          </button>
        </div>
      </main>
    );
  }

  const latestMovie = movies.length > 0 ? movies[movies.length - 1] : null;

  return (
    <main className="min-h-screen bg-[#141414] text-[#F5F2EB] p-6 max-w-md mx-auto font-sans antialiased animate-fadeIn pb-12 relative overflow-hidden">

      {isSpecialDay && (
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#E6C687]/5 rounded-full blur-3xl pointer-events-none"></div>
      )}

      {!selectedMovie && !isAdding && !editingMovie ? (
        <div className="space-y-6 relative z-10">

          {isSpecialDay && (
            <div className="bg-gradient-to-r from-[#1C1C1C] via-[#24201B] to-[#1C1C1C] border border-[#E6C687]/20 px-4 py-3 rounded-[16px] text-center shadow-sm">
              <p className="text-xs font-serif text-[#E6C687] italic">✨ &ldquo;Every milestone with you is our favorite scene.&rdquo;</p>
            </div>
          )}

          {/* Header & Tagline */}
          <div className="flex justify-between items-center pt-2">
            <div>
              <h1 className="text-2xl font-serif font-normal text-[#F5F2EB] tracking-wide">❤️ Movie Journal</h1>
              <p className="text-xs text-[#A8A59F] mt-1 italic font-serif tracking-wide">Every movie tells our story.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAdding(true)}
                className="bg-[#262626] border border-[#383838] hover:bg-[#303030] text-[#F5F2EB] px-4 py-2 rounded-[16px] text-xs font-medium transition-all transform hover:scale-[1.02] shadow-sm cursor-pointer flex items-center gap-1"
              >
                + Add Movie
              </button>
              <button
                onClick={handleLogout}
                className="bg-[#1C1C1C] border border-[#2D2D2D] hover:bg-[#252525] text-[#A8A59F] px-3.5 py-2 rounded-[16px] text-xs transition-all cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="border-t border-[#222222] my-4"></div>

          {/* Navigation Tabs */}
          <div className="flex bg-[#1C1C1C] p-1 rounded-[18px] border border-[#2D2D2D]">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 py-2 text-xs font-medium rounded-[14px] transition-all cursor-pointer ${activeTab === 'timeline' ? 'bg-[#282828] text-[#F5F2EB] shadow-sm' : 'text-[#8A8780] hover:text-[#F5F2EB]'}`}
            >
              📅 Timeline
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex-1 py-2 text-xs font-medium rounded-[14px] transition-all cursor-pointer ${activeTab === 'stats' ? 'bg-[#282828] text-[#F5F2EB] shadow-sm' : 'text-[#8A8780] hover:text-[#F5F2EB]'}`}
            >
              🏆 Milestones & Stats
            </button>
          </div>

          {activeTab === 'timeline' ? (
            <div className="space-y-6">
              {/* Latest Memory Hero Card */}
              {latestMovie && (
                <div
                  onClick={() => setSelectedMovie(latestMovie)}
                  className="bg-gradient-to-br from-[#1C1C1C]/90 to-[#181818]/90 backdrop-blur-md border border-[#33302A]/80 p-6 rounded-[24px] cursor-pointer hover:border-[#E6C687]/50 hover:shadow-lg transition-all transform hover:scale-[1.02] space-y-4 group"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-[#D94F4F] font-semibold tracking-wider uppercase flex items-center gap-1 font-sans">
                      <span>❤️</span> Latest Memory
                    </span>
                    <span className="text-xs text-[#706D66] group-hover:text-[#A8A59F] transition-colors">Open →</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-serif text-[#F5F2EB] italic leading-relaxed">&ldquo;{latestMovie.memory}&rdquo;</p>
                    <p className="text-xs text-[#E6C687] font-serif font-medium">— {latestMovie.name}</p>
                  </div>
                </div>
              )}

              {/* Vertical Timeline Grouped by Year with "Our History" Header */}
              <div className="pt-2 space-y-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-serif font-normal text-[#F5F2EB] tracking-wide">Our History</h2>
                  <div className="h-[1px] bg-[#2A2A2A] flex-1"></div>
                </div>

                {Array.from(new Set(movies.map((m) => new Date(m.date).getFullYear())))
                  .sort((a, b) => b - a)
                  .map((year) => {
                    const yearMovies = movies.filter((m) => new Date(m.date).getFullYear() === year);

                    return (
                      <div key={year} className="space-y-4">
                        <span className="text-xs font-serif font-medium text-[#E6C687] tracking-wider uppercase block">{year}</span>

                        <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#282828]">
                          {yearMovies.map((movie) => (
                            <div
                              key={movie.id}
                              onClick={() => setSelectedMovie(movie)}
                              className="relative group cursor-pointer"
                            >
                              <div className="absolute -left-[23px] top-1 w-6 h-6 rounded-full bg-[#1C1C1C] border border-[#383838] flex items-center justify-center text-[10px] shadow-sm group-hover:border-[#E6C687] transition-colors">
                                ❤️
                              </div>

                              <div className="bg-[#1C1C1C]/60 backdrop-blur-sm border border-[#282828]/70 p-4 rounded-[20px] group-hover:border-[#E6C687]/40 group-hover:bg-[#1C1C1C]/90 group-hover:shadow-md transition-all transform group-hover:scale-[1.01]">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="text-[11px] font-medium text-[#E6C687] tracking-wider">{formatHumanDate(movie.date)}</span>
                                    <h3 className="font-serif font-normal text-lg text-[#F5F2EB] mt-0.5">{movie.name}</h3>
                                    <p className="text-xs text-[#8A8780] font-sans mt-0.5 flex items-center gap-1">
                                      <span>📍</span> {movie.theatre}
                                    </p>
                                  </div>
                                  <span className="text-[#E6C687] text-xs font-semibold">{movie.rating}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            /* Milestones & Clickable Year-Wise Statistics View */
            <div className="space-y-6 animate-fadeIn">
              {Array.from(new Set(movies.map((m) => new Date(m.date).getFullYear())))
                .sort((a, b) => b - a)
                .map((year) => {
                  const yearMovies = movies.filter((m) => new Date(m.date).getFullYear() === year);
                  const yearTotal = yearMovies.length;
                  const isExpanded = expandedYearStats === year;

                  let yearAvgRating = '5.0';
                  if (yearTotal > 0) {
                    const sum = yearMovies.reduce((acc, m) => {
                      const num = parseFloat(m.rating);
                      return acc + (isNaN(num) ? 5.0 : num);
                    }, 0);
                    yearAvgRating = (sum / yearTotal).toFixed(1);
                  }

                  return (
                    <div key={year} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h2 className="text-sm font-serif font-normal text-[#E6C687] tracking-wider">{year} Wrapped</h2>
                        <div className="h-[1px] bg-[#2A2A2A] flex-1"></div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Clicking this card toggles the movie list dropdown */}
                        <div
                          onClick={() => setExpandedYearStats(isExpanded ? null : year)}
                          className="bg-[#1C1C1C]/80 border border-[#2D2D2D]/80 hover:border-[#E6C687]/40 p-4 rounded-[22px] shadow-sm space-y-1 cursor-pointer transition-all"
                        >
                          <p className="text-[10px] uppercase tracking-widest text-[#8A8780] font-medium flex justify-between items-center">
                            <span>🎬 Movies in {year}</span>
                            <span className="text-xs">{isExpanded ? '▲' : '▼'}</span>
                          </p>
                          <p className="text-xl font-serif font-normal text-[#F5F2EB] mt-1">{yearTotal} memories</p>
                        </div>

                        <div className="bg-[#1C1C1C]/80 border border-[#2D2D2D]/80 p-4 rounded-[22px] shadow-sm space-y-1">
                          <p className="text-[10px] uppercase tracking-widest text-[#8A8780] font-medium">⭐ {year} Avg Rating</p>
                          <p className="text-xl font-serif font-normal text-[#E6C687] mt-1">{yearAvgRating} ⭐</p>
                        </div>
                      </div>

                      {/* Dropdown list of movie names when clicked */}
                      {isExpanded && (
                        <div className="bg-[#181818] border border-[#2D2D2D] rounded-[20px] p-4 space-y-2 animate-fadeIn">
                          <p className="text-[11px] text-[#8A8780] uppercase tracking-wider font-semibold mb-2">Movie List ({year}):</p>
                          {yearMovies.map((movie) => (
                            <div
                              key={movie.id}
                              onClick={() => setSelectedMovie(movie)}
                              className="flex justify-between items-center py-2 px-3 rounded-[12px] bg-[#222222]/60 hover:bg-[#282828] cursor-pointer transition-colors"
                            >
                              <span className="text-sm font-serif text-[#F5F2EB]">{movie.name}</span>
                              <span className="text-xs text-[#E6C687]">{movie.rating}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* All-Time Totals */}
              <div className="pt-2">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-serif font-normal text-[#F5F2EB] tracking-wider">All-Time Totals</h2>
                  <div className="h-[1px] bg-[#2A2A2A] flex-1"></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#1C1C1C]/80 border border-[#2D2D2D]/80 p-4 rounded-[22px] shadow-sm space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-[#8A8780] font-medium">✨ Since First Movie</p>
                    <p className="text-lg font-serif font-normal text-[#E6C687] mt-1">{daysSinceFirst} Days</p>
                  </div>
                  <div className="bg-[#1C1C1C]/80 border border-[#2D2D2D]/80 p-4 rounded-[22px] shadow-sm space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-[#8A8780] font-medium">⭐ Overall Average</p>
                    <p className="text-lg font-serif font-normal text-[#F5F2EB] mt-1">{averageRating} ⭐</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : isAdding ? (
        /* Add Movie Form View */
        <div className="space-y-4 animate-slideUp relative z-10">
          <button
            onClick={() => setIsAdding(false)}
            className="bg-[#1C1C1C] border border-[#2D2D2D] text-[#A8A59F] px-4 py-2 rounded-[16px] text-xs font-medium hover:bg-[#252525] transition-all cursor-pointer"
          >
            ← Cancel
          </button>

          <form onSubmit={handleAddMovie} className="bg-[#1C1C1C]/90 backdrop-blur-md border border-[#2D2D2D] p-6 rounded-[24px] space-y-4 shadow-xl">
            <h2 className="text-xl font-serif font-normal text-[#F5F2EB] mb-1">Add New Movie Date</h2>

            <div>
              <label className="block text-xs text-[#8A8780] mb-1">Movie Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Leo"
                required
                className="w-full bg-[#141414] border border-[#2D2D2D] p-3 rounded-[16px] text-sm text-[#F5F2EB] focus:border-[#E6C687] outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8A8780] mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-[#141414] border border-[#2D2D2D] p-3 rounded-[16px] text-sm text-[#F5F2EB] focus:border-[#E6C687] outline-none transition-colors color-scheme-dark"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8A8780] mb-1">Theatre</label>
              <input
                type="text"
                value={theatre}
                onChange={(e) => setTheatre(e.target.value)}
                placeholder="e.g., BSR Mall"
                required
                className="w-full bg-[#141414] border border-[#2D2D2D] p-3 rounded-[16px] text-sm text-[#F5F2EB] focus:border-[#E6C687] outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8A8780] mb-1">Rating</label>
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="w-full bg-[#141414] border border-[#2D2D2D] p-3 rounded-[16px] text-sm text-[#F5F2EB] focus:border-[#E6C687] outline-none transition-colors cursor-pointer"
              >
                <option value="5.0 ⭐">5.0 ⭐</option>
                <option value="4.9 ⭐">4.9 ⭐</option>
                <option value="4.8 ⭐">4.8 ⭐</option>
                <option value="4.7 ⭐">4.7 ⭐</option>
                <option value="4.6 ⭐">4.6 ⭐</option>
                <option value="4.5 ⭐">4.5 ⭐</option>
                <option value="4.0 ⭐">4.0 ⭐</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#8A8780] mb-1">Ticket / Selfie Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full bg-[#141414] border border-[#2D2D2D] p-2.5 rounded-[16px] text-xs text-[#8A8780] file:mr-4 file:py-1.5 file:px-3 file:rounded-[12px] file:border-0 file:text-xs file:font-semibold file:bg-[#F5F2EB] file:text-[#141414] hover:file:bg-white cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8A8780] mb-1">One Memory</label>
              <textarea
                value={memory}
                onChange={(e) => setMemory(e.target.value)}
                placeholder="Write a special note about this movie date..."
                rows={3}
                className="w-full bg-[#141414] border border-[#2D2D2D] p-3 rounded-[16px] text-sm text-[#F5F2EB] focus:border-[#E6C687] outline-none resize-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full bg-[#F5F2EB] hover:bg-white text-[#141414] font-semibold p-3.5 rounded-[16px] transition-all transform hover:scale-[1.01] shadow-lg mt-2 cursor-pointer disabled:opacity-50 text-sm"
            >
              {uploading ? 'Saving memory...' : 'Save Movie Memory ❤️'}
            </button>
          </form>
        </div>
      ) : editingMovie ? (
        /* Edit Movie Form View with Delete Button */
        <div className="space-y-4 animate-slideUp relative z-10">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setEditingMovie(null)}
              className="bg-[#1C1C1C] border border-[#2D2D2D] text-[#A8A59F] px-4 py-2 rounded-[16px] text-xs font-medium hover:bg-[#252525] transition-all cursor-pointer"
            >
              ← Cancel
            </button>

            <button
              onClick={() => handleDeleteMovie(editingMovie.id)}
              className="bg-[#D94F4F]/10 border border-[#D94F4F]/30 text-[#D94F4F] px-4 py-2 rounded-[16px] text-xs font-medium hover:bg-[#D94F4F]/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <span>🗑️</span> Delete Memory
            </button>
          </div>

          <form onSubmit={handleUpdateMovie} className="bg-[#1C1C1C]/90 backdrop-blur-md border border-[#2D2D2D] p-6 rounded-[24px] space-y-4 shadow-xl">
            <h2 className="text-xl font-serif font-normal text-[#F5F2EB] mb-1">Edit Movie Memory</h2>

            <div>
              <label className="block text-xs text-[#8A8780] mb-1">Movie Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-[#141414] border border-[#2D2D2D] p-3 rounded-[16px] text-sm text-[#F5F2EB] focus:border-[#E6C687] outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8A8780] mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-[#141414] border border-[#2D2D2D] p-3 rounded-[16px] text-sm text-[#F5F2EB] focus:border-[#E6C687] outline-none transition-colors color-scheme-dark"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8A8780] mb-1">Theatre</label>
              <input
                type="text"
                value={theatre}
                onChange={(e) => setTheatre(e.target.value)}
                required
                className="w-full bg-[#141414] border border-[#2D2D2D] p-3 rounded-[16px] text-sm text-[#F5F2EB] focus:border-[#E6C687] outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8A8780] mb-1">Rating</label>
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="w-full bg-[#141414] border border-[#2D2D2D] p-3 rounded-[16px] text-sm text-[#F5F2EB] focus:border-[#E6C687] outline-none transition-colors cursor-pointer"
              >
                <option value="5.0 ⭐">5.0 ⭐</option>
                <option value="4.9 ⭐">4.9 ⭐</option>
                <option value="4.8 ⭐">4.8 ⭐</option>
                <option value="4.7 ⭐">4.7 ⭐</option>
                <option value="4.6 ⭐">4.6 ⭐</option>
                <option value="4.5 ⭐">4.5 ⭐</option>
                <option value="4.0 ⭐">4.0 ⭐</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#8A8780] mb-1">Update Ticket / Selfie Photo (optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full bg-[#141414] border border-[#2D2D2D] p-2.5 rounded-[16px] text-xs text-[#8A8780] file:mr-4 file:py-1.5 file:px-3 file:rounded-[12px] file:border-0 file:text-xs file:font-semibold file:bg-[#F5F2EB] file:text-[#141414] hover:file:bg-white cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8A8780] mb-1">One Memory</label>
              <textarea
                value={memory}
                onChange={(e) => setMemory(e.target.value)}
                rows={3}
                className="w-full bg-[#141414] border border-[#2D2D2D] p-3 rounded-[16px] text-sm text-[#F5F2EB] focus:border-[#E6C687] outline-none resize-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full bg-[#F5F2EB] hover:bg-white text-[#141414] font-semibold p-3.5 rounded-[16px] transition-all transform hover:scale-[1.01] shadow-lg mt-2 cursor-pointer disabled:opacity-50 text-sm"
            >
              {uploading ? 'Updating memory...' : 'Save Changes ❤️'}
            </button>
          </form>
        </div>
      ) : (
        /* Emotional Movie Details View with Edit Button */
        <div className="space-y-5 animate-slideUp relative z-10">

          {selectedMovie.media_url && (
            <div className="absolute inset-0 -mx-6 -mt-6 h-96 overflow-hidden pointer-events-none opacity-20 filter blur-3xl z-0">
              <img src={selectedMovie.media_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="relative z-10 space-y-5">
            <div className="flex justify-between items-center">
              <button
                onClick={() => setSelectedMovie(null)}
                className="bg-[#1C1C1C]/90 backdrop-blur-md border border-[#2D2D2D] text-[#A8A59F] px-4 py-2 rounded-[16px] text-xs font-medium hover:bg-[#252525] transition-all cursor-pointer shadow-sm"
              >
                ← Back to Timeline
              </button>

              <button
                onClick={() => startEditing(selectedMovie)}
                className="bg-[#262626] border border-[#383838] text-[#E6C687] px-4 py-2 rounded-[16px] text-xs font-medium hover:bg-[#303030] transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <span>✏️</span> Edit Memory
              </button>
            </div>

            <div className="bg-[#1C1C1C]/85 backdrop-blur-xl border border-[#2D2D2D] p-7 rounded-[28px] space-y-6 shadow-2xl">

              <div className="space-y-2">
                <span className="text-[#E6C687] text-sm tracking-widest">{selectedMovie.rating}</span>
                <h2 className="text-3xl font-serif font-normal text-[#F5F2EB]">{selectedMovie.name}</h2>
                <p className="text-xs text-[#8A8780] font-sans">📅 {formatHumanDate(selectedMovie.date)} • 📍 {selectedMovie.theatre}</p>
              </div>

              <div className="border-t border-[#2A2A2A]"></div>

              <div className="space-y-2">
                <span className="text-[11px] text-[#D94F4F] font-semibold tracking-wider uppercase flex items-center gap-1 font-sans">
                  <span>❤️</span> One Memory
                </span>
                <p className="text-base font-serif text-[#F5F2EB] leading-relaxed italic">
                  &ldquo;{selectedMovie.memory}&rdquo;
                </p>
              </div>

              {selectedMovie.media_url && (
                <div className="pt-2 space-y-2">
                  <p className="text-xs text-[#8A8780] font-medium tracking-wider uppercase font-sans">🎟️ Ticket & Photo Gallery</p>
                  <div className="rounded-[20px] overflow-hidden border border-[#2D2D2D] bg-[#141414] shadow-md">
                    <img
                      src={selectedMovie.media_url}
                      alt={selectedMovie.name}
                      className="w-full object-cover max-h-72 hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </main>
  );
}