"use client";

import { useEffect, useCallback, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { useFrameSDK } from "~/hooks/useFrameSDK";

// Spotify API types
interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  external_urls: {
    spotify: string;
  };
}

interface SpotifyCurrentlyPlaying {
  is_playing: boolean;
  item: SpotifyTrack | null;
}

function SpotifyCard({ currentTrack, isPlaying, onRefresh, isLoading }: { 
  currentTrack: SpotifyTrack | null; 
  isPlaying: boolean;
  onRefresh: () => void;
  isLoading: boolean;
}) {
  if (!currentTrack) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Spotify Now Playing</CardTitle>
          <CardDescription>
            Connect with Spotify to see what you&apos;re listening to
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6">
          <Button 
            onClick={() => window.location.href = '/api/spotify/login'} 
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            Connect Spotify
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">
          {isPlaying ? "Now Playing" : "Last Played"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        {currentTrack.album.images[0] && (
          <img 
            src={currentTrack.album.images[0].url} 
            alt={`${currentTrack.album.name} cover`} 
            className="w-32 h-32 rounded-md shadow-md mb-4"
          />
        )}
        <div className="text-center">
          <h3 className="font-bold text-lg">{currentTrack.name}</h3>
          <p className="text-sm text-gray-500">
            {currentTrack.artists.map(artist => artist.name).join(", ")}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {currentTrack.album.name}
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          onClick={onRefresh} 
          disabled={isLoading}
          size="sm" 
          variant="outline"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </Button>
        <Button 
          onClick={() => window.open(currentTrack.external_urls.spotify, '_blank')} 
          size="sm"
          className="bg-green-500 hover:bg-green-600 text-white"
        >
          Open in Spotify
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function Frame() {
  const { isSDKLoaded, sdk } = useFrameSDK();
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Define fetchNowPlaying before using it in useEffect

  // Check if user is authenticated with Spotify
  useEffect(() => {
    const spotifyToken = localStorage.getItem('spotify_access_token');
    if (spotifyToken) {
      setIsAuthenticated(true);
      fetchNowPlaying();
    }
  }, [fetchNowPlaying]);

  // Signal to the Farcaster client that the frame is ready
  useEffect(() => {
    if (sdk && isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [sdk, isSDKLoaded]);

  const fetchNowPlaying = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('spotify_access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      // In a real app, you would call your backend API that proxies to Spotify
      // For demo purposes, we're simulating a direct call
      const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 204) {
        // No content - nothing playing
        const recentlyPlayed = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (recentlyPlayed.ok) {
          const data = await recentlyPlayed.json();
          if (data.items && data.items.length > 0) {
            setCurrentTrack(data.items[0].track);
            setIsPlaying(false);
          }
        }
      } else if (response.ok) {
        const data: SpotifyCurrentlyPlaying = await response.json();
        setCurrentTrack(data.item);
        setIsPlaying(data.is_playing);
      } else if (response.status === 401) {
        // Token expired
        localStorage.removeItem('spotify_access_token');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error fetching Spotify data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle Spotify auth callback
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        localStorage.setItem('spotify_access_token', token);
        setIsAuthenticated(true);
        window.location.hash = '';
        fetchNowPlaying();
      }
    }
  }, [fetchNowPlaying]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-[300px] mx-auto py-2 px-2">
      <SpotifyCard 
        currentTrack={currentTrack} 
        isPlaying={isPlaying} 
        onRefresh={fetchNowPlaying}
        isLoading={isLoading}
      />
    </div>
  );
}
