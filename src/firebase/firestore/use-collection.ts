import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

export function useCollection<T = any>(
    query: CollectionReference<DocumentData> | Query<DocumentData> | null | undefined,
    mockDataFallback?: WithId<T>[]
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!query) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    let mounted = true;
    
    // Fallback timer for mock data
    const timeoutId = setTimeout(() => {
      if (mounted && mockDataFallback) {
        console.warn("Firestore timed out, using mock data");
        setData(mockDataFallback);
        setIsLoading(false);
      }
    }, 1500);

    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<DocumentData>) => {
        if (!mounted) return;
        clearTimeout(timeoutId);
        
        const results: ResultItemType[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        if (!mounted) return;
        clearTimeout(timeoutId);
        
        console.error("Firestore Error:", err);
        
        if (mockDataFallback) {
             console.warn("Using mock data due to error");
             setData(mockDataFallback);
             setError(null); // Clear error to show data
        } else {
             setError(err);
             setData(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [query, mockDataFallback]); 

  return { data, isLoading, error };
}
