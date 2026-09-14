'use server';

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export interface Movie {
  id: number;
  name: string;
  date: string;
  theatre: string;
  rating: string;
  memory: string;
  media_url?: string; // Keep this just in case they have old data, but we won't use it
}

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

async function getDoc() {
  const jwt = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  });

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID || '', jwt);
  await doc.loadInfo();
  return doc;
}

export async function getMovies(): Promise<Movie[]> {
  try {
    const doc = await getDoc();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    return rows.map((row) => ({
      id: Number(row.get('ID')),
      name: row.get('Movie Name') || '',
      date: row.get('Date') || '',
      theatre: row.get('Theatre') || '',
      rating: row.get('Rating') || '',
      memory: row.get('Memory') || '',
    }));
  } catch (error) {
    console.error('Failed to fetch movies', error);
    return [];
  }
}

export async function addMovie(movieData: Omit<Movie, 'id'>) {
  try {
    const doc = await getDoc();
    const sheet = doc.sheetsByIndex[0];
    
    // Auto-generate an ID
    const newId = Date.now();
    const newRow = {
      'ID': newId,
      'Created At': new Date().toISOString(),
      'Movie Name': movieData.name,
      'Date': movieData.date,
      'Theatre': movieData.theatre,
      'Rating': movieData.rating,
      'Memory': movieData.memory,
    };
    
    await sheet.addRow(newRow);
    return { success: true, movie: newRow };
  } catch (error) {
    console.error('Failed to add movie', error);
    return { success: false, error: 'Failed to add movie' };
  }
}

export async function updateMovie(id: number, movieData: Omit<Movie, 'id'>) {
  try {
    const doc = await getDoc();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    const targetRow = rows.find(r => Number(r.get('ID')) === id);
    if (!targetRow) throw new Error('Movie not found');
    
    targetRow.set('Movie Name', movieData.name);
    targetRow.set('Date', movieData.date);
    targetRow.set('Theatre', movieData.theatre);
    targetRow.set('Rating', movieData.rating);
    targetRow.set('Memory', movieData.memory);
    
    await targetRow.save();
    return { success: true, movie: { id, ...movieData } };
  } catch (error) {
    console.error('Failed to update movie', error);
    return { success: false, error: 'Failed to update movie' };
  }
}

export async function deleteMovie(id: number) {
  try {
    const doc = await getDoc();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    const targetRow = rows.find(r => Number(r.get('ID')) === id);
    if (!targetRow) throw new Error('Movie not found');
    
    await targetRow.delete();
    return { success: true };
  } catch (error) {
    console.error('Failed to delete movie', error);
    return { success: false, error: 'Failed to delete movie' };
  }
}
