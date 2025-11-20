import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RegistrationData {
  email: string;
  googleId: string;
  fullName: string;
  phoneNumber?: string;
  inGameName?: string;
  dota2FriendId?: string;
  steamProfileLink?: string;
  rankAndMmr?: string;
  discordId?: string;
  upiId?: string;
}

export interface RegistrationStatus {
  exists: boolean;
  status?: string;
  userId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RegistrationService {
  private apiUrl = `${environment.apiUrl}/registration`;

  constructor(private http: HttpClient) {}

  createRegistration(formData: FormData): Observable<any> {
    return this.http.post(this.apiUrl, formData);
  }

  getMyRegistration(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`, {
      headers: { 'x-user-id': userId }
    });
  }

  getRegistrationStatus(userId: string): Observable<RegistrationStatus> {
    return this.http.get<RegistrationStatus>(`${this.apiUrl}/status`, {
      headers: { 'x-user-id': userId }
    });
  }

  updateRegistration(userId: string, formData: FormData): Observable<any> {
    return this.http.put(`${this.apiUrl}/me`, formData, {
      headers: { 'x-user-id': userId }
    });
  }
}

