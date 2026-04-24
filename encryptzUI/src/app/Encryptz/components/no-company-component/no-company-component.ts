import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';

@Component({
  selector: 'app-no-company-component',
  imports: [CommonModule, RouterModule],
  templateUrl: './no-company-component.html',
  styleUrl: './no-company-component.scss',
})
export class NoCompanyComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  checkingInvitations = signal(false);
  checkingRequests = signal(false);
  showInvitations = signal(false);
  showRequests = signal(false);
  invitations = signal<any[]>([]);
  pendingRequests = signal<any[]>([]);
  showShareOptions = signal(false);

  userEmail = signal('');
  userFullName = signal('');
  userId = signal(0);

  ngOnInit() {
    this.loadUserInfo();
    this.loadPendingRequests();
  }

  loadUserInfo() {
    const currentUser = this.auth.currentUser();
    if (currentUser) {
      this.userFullName.set(currentUser.fullName || '');
      this.userId.set(currentUser.userId || 0);
      if ((currentUser as any).email) {
        this.userEmail.set((currentUser as any).email);
      } else {
        const storedUser = localStorage.getItem('felix_user');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            this.userEmail.set(userData.email || '');
          } catch (e) {
            console.error('Error parsing user data', e);
          }
        }
      }
    }
  }

  // Load user's own pending join requests (where they requested to join)
  loadPendingRequests() {
    this.checkingRequests.set(true);
    this.auth.getMyJoinRequests().subscribe({
      next: (requests) => {
        this.checkingRequests.set(false);
        this.pendingRequests.set(requests || []);
        this.showRequests.set(true);
      },
      error: () => {
        this.checkingRequests.set(false);
        this.pendingRequests.set([]);
      }
    });
  }

  // Cancel user's own join request
  cancelRequest(requestId: number) {
    if (confirm('Are you sure you want to cancel this join request?')) {
      this.auth.cancelJoinRequest(requestId).subscribe({
        next: (res) => {
          if (res.success) {
            alert('Join request cancelled successfully');
            this.loadPendingRequests();
          } else {
            alert(res.message || 'Failed to cancel request');
          }
        },
        error: (err) => {
          alert(err.error?.message || 'Failed to cancel request');
        }
      });
    }
  }

  checkInvitations() {
    const email = this.userEmail();
    if (!email) {
      this.router.navigate(['/login']);
      return;
    }

    this.checkingInvitations.set(true);
    this.auth.getPendingInvitations(email).subscribe({
      next: (invites) => {
        this.checkingInvitations.set(false);
        this.invitations.set(invites.data || []);
        this.showInvitations.set(true);
      },
      error: () => {
        this.checkingInvitations.set(false);
        this.invitations.set([]);
      }
    });
  }

  acceptInvitation(token: string) {
    this.auth.acceptInvitation(token).subscribe({
      next: (res) => {
        if (res.success) {
          alert('Invitation accepted! You can now select your company.');
          this.router.navigate(['/select-company']);
        } else {
          alert(res.message || 'Failed to accept invitation');
        }
      },
      error: (err) => {
        alert('Error accepting invitation');
      }
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  toggleShareOptions() {
    this.showShareOptions.set(!this.showShareOptions());
  }

  shareViaEmail() {
    const subject = encodeURIComponent('Request to Join Company - ENCRYPTZ Platform');
    const body = encodeURIComponent(this.getShareMessage());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  shareViaWhatsApp() {
    const text = encodeURIComponent(this.getShareMessage());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  shareViaTelegram() {
    const text = encodeURIComponent(this.getShareMessage());
    window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${text}`, '_blank');
  }

  shareViaSMS() {
    const text = encodeURIComponent(this.getShareMessage());
    window.location.href = `sms:?body=${text}`;
  }
  rejectInvitation(invitationId: number) {
    if (confirm('Are you sure you want to reject this invitation?')) {
      this.auth.rejectInvitation(invitationId).subscribe({
        next: (res) => {
          if (res.success) {
            alert('Invitation rejected successfully');
            this.checkInvitations(); // Refresh the list
          } else {
            alert(res.message || 'Failed to reject invitation');
          }
        },
        error: (err) => {
          alert(err.error?.message || 'Failed to reject invitation');
        }
      });
    }
  }
  copyToClipboard() {
    const message = this.getShareMessage();
    navigator.clipboard.writeText(message).then(() => {
      alert('Request message copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy');
    });
  }

  private getShareMessage(): string {
    return `Hello,

I would like to request access to join your company on ENCRYPTZ ERP Platform.

━━━━━━━━━━━━━━━━━━━━━
📧 Email: ${this.userEmail()}
👤 Name: ${this.userFullName()}
🆔 User ID: ${this.userId()}
━━━━━━━━━━━━━━━━━━━━━

Please add me to your company or send me an invitation.

Thank you!`;
  }
}
