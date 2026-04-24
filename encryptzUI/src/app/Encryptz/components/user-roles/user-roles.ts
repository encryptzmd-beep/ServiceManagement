// auth-management-component.ts - COMPLETE CORRECTED VERSION
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../Auth/auth-service';
export interface UserDto {
  userId: number;
  fullName: string;
  email: string;
  mobileNumber: string;
  roleId: number;
  roleName: string;
  isActive: boolean;
  createdAt: string;
}

export interface RoleDto {
  roleId: number;
  roleName: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface MenuAccessDto {
  menuId: number;
  menuName: string;
  menuPath?: string;
  parentMenuId?: number;
  sortOrder: number;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  hasAccess: boolean;
}

export interface CompanyUserDetailDto {
  companyUserId: number;
  userId: number;
  fullName: string;
  email: string;
  mobileNumber: string;
  roleInCompany: string;
  assignedAt: string;
  assignedBy: string;
  isActive: boolean;
}

export interface InvitationDetailDto {
  invitationId: number;
  email: string;
  roleInCompany: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  createdByName: string;
}

export interface JoinRequestDto {
  requestId: number;
  userId: number;
  userName: string;
  userEmail: string;
  mobileNumber: string;
  requestedRole: string;
  remarks?: string;
  requestedAt: string;
  status: string;
}

export interface CompanyInfoDto {
  companyId: number;
  companyName: string;
  companyCode: string;
  city?: string;
  userStatus: 'Member' | 'Requested' | 'Available';
}
@Component({
  selector: 'app-user-roles',
   imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './user-roles.html',
  styleUrl: './user-roles.scss',
})
export class UserRoles {
   svc = inject(AuthService);
  private fb = inject(FormBuilder);

  // ============================================
  // TAB STATE
  // ============================================
  activeTab = signal<'users' | 'roles' | 'access' | 'company-users' | 'join-requests'>('users');

  // ============================================
  // TAB 1: USERS (Global)
  // ============================================
  users = signal<UserDto[]>([]);
  roles = signal<RoleDto[]>([]);
  showUserForm = signal(false);
  editingUser = signal<UserDto | null>(null);

  // Search users (for invite modal)
  searchUserTerm = signal<string>('');
  searchResults = signal<UserDto[]>([]);
  searchingUsers = signal(false);
  showSearchResults = signal(false);
  selectedInviteUser = signal<UserDto | null>(null);

  userForm = this.fb.group({
    userId: [0],
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    mobileNumber: ['', Validators.required],
    roleId: [0, [Validators.required, Validators.min(1)]],
    isActive: [true],
    password: ['']
  });

  // ============================================
  // TAB 2: ROLES
  // ============================================
  showRoleForm = signal(false);
  editingRole = signal<RoleDto | null>(null);

  // Client-side filters for roles table
  roleSearchTerm = signal<string>('');
  roleStatusFilter = signal<'all' | 'active' | 'inactive'>('all');

  filteredRoles = computed(() => {
    const term = this.roleSearchTerm().trim().toLowerCase();
    const status = this.roleStatusFilter();
    return this.roles().filter(r => {
      const matchesTerm = !term
        || (r.roleName || '').toLowerCase().includes(term)
        || (r.description || '').toLowerCase().includes(term);
      const matchesStatus = status === 'all'
        || (status === 'active' && r.isActive)
        || (status === 'inactive' && !r.isActive);
      return matchesTerm && matchesStatus;
    });
  });

  totalRoleCount = computed(() => this.roles().length);
  activeRoleCount = computed(() => this.roles().filter(r => r.isActive).length);
  inactiveRoleCount = computed(() => this.roles().filter(r => !r.isActive).length);
  activePercent = computed(() => {
    const t = this.totalRoleCount();
    if (!t) return 0;
    return Math.round((this.activeRoleCount() / t) * 1000) / 10;
  });

  roleForm = this.fb.group({
    roleId: [0],
    roleName: ['', Validators.required],
    description: [''],
    isActive: [true]
  });

  // ============================================
  // TAB 3: MENU ACCESS
  // ============================================
  selectedRoleId = signal(0);
  menuAccess = signal<MenuAccessDto[]>([]);
  savingAccess = signal(false);

  parentMenus = computed(() =>
    this.menuAccess().filter(m => !m.parentMenuId)
  );
  childMenus = (parentId: number) =>
    this.menuAccess().filter(m => m.parentMenuId === parentId);

  // ============================================
  // TAB 4: COMPANY USERS
  // ============================================
  companyUsers = signal<CompanyUserDetailDto[]>([]);
  pendingInvitations = signal<InvitationDetailDto[]>([]);
  showInviteModal = signal(false);
  showRoleModal = signal(false);
  selectedUser = signal<CompanyUserDetailDto | null>(null);

  // Regular variables for form data (not signals)
  inviteEmail: string = '';
  inviteRole: string = 'Technician';
  inviteRemarks: string = '';
  lookupUserEmail: string = '';
  lookedUpUser: UserDto | null = null;
  isLookingUpUser: boolean = false;
  userNotFound: boolean = false;

  // For Join Requests
  selectedCompanyId = signal<number>(0);
  requestedRole: string = 'Technician';
  requestRemarks: string = '';

  // Active roles (computed from roles)
  activeRoles = computed(() => {
    return this.roles().filter(role => role.isActive === true);
  });

  // ============================================
  // TAB 5: JOIN REQUESTS
  // ============================================
  pendingJoinRequests = signal<JoinRequestDto[]>([]);
  availableCompanies = signal<CompanyInfoDto[]>([]);
  showRequestsModal = signal(false);

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================

  ngOnInit() {
    this.loadUsers();
    this.loadRoles();
    this.switchTab('roles')
  }

  // ============================================
  // TAB SWITCHING
  // ============================================

  switchTab(tab: 'users' | 'roles' | 'access' | 'company-users' | 'join-requests') {
    this.activeTab.set(tab);

    if (tab === 'access' && this.roles().length === 0) {
      this.loadRoles();
    }

    if (tab === 'company-users') {
      this.loadCompanyUsers();
      this.loadPendingInvitations();
    }

    if (tab === 'join-requests') {
      this.loadPendingJoinRequests();
    }
  }
openRoleForm(role?: RoleDto) {
  this.editingRole.set(role ?? null);

  this.roleForm.reset({
    roleId: role?.roleId ?? 0,
    roleName: role?.roleName ?? '',
    description: role?.description ?? '',
    isActive: role?.isActive ?? true
  });

  // Load permissions automatically when editing a role
  if (role?.roleId) {
    this.selectedRoleId.set(role.roleId);
    this.loadMenuAccess();
  } else {
    this.menuAccess.set([]);
  }

  this.showRoleForm.set(true);
}
  // ============================================
  // TAB 1: USER OPERATIONS
  // ============================================

  loadUsers() {
    this.svc.getUsers().subscribe((u: any) => {
      this.users.set(u.data || u);
    });
  }
 getRoleDisplayName(roleName: string): string {
    // If your role names don't match exactly, map them here
    const roleMap: { [key: string]: string } = {
      'ServiceManager': 'Service Manager',
      'Technician': 'Technician',
      'Admin': 'Admin',
      'Manager': 'Manager'
    };
    return roleMap[roleName] || roleName;
  }
  openUserForm(user?: UserDto) {
    this.editingUser.set(user ?? null);
    this.userForm.reset({
      userId: user?.userId ?? 0,
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      mobileNumber: user?.mobileNumber ?? '',
      roleId: user?.roleId ?? 0,
      isActive: user?.isActive ?? true,
      password: ''
    });
    this.showUserForm.set(true);
  }

  saveUser() {
    if (this.userForm.invalid) return;
    this.svc.saveUser(this.userForm.value).subscribe(() => {
      this.showUserForm.set(false);
      this.loadUsers();
    });
  }

  // ============================================
  // TAB 2: ROLE OPERATIONS
  // ============================================

  loadRoles() {
    this.svc.getRoles().subscribe((r: any) => {
      const allRoles = r.data || r;
      this.roles.set(allRoles);
    });
  }

  // openRoleForm(role?: RoleDto) {
  //   this.editingRole.set(role ?? null);
  //   this.roleForm.reset({
  //     roleId: role?.roleId ?? 0,
  //     roleName: role?.roleName ?? '',
  //     description: role?.description ?? '',
  //     isActive: role?.isActive ?? true
  //   });
  //   this.showRoleForm.set(true);
  // }

  saveRole() {
    if (this.roleForm.invalid) return;
    this.svc.saveRole(this.roleForm.value).subscribe(() => {
      this.showRoleForm.set(false);
      this.loadRoles();
    });
  }

  // ============================================
  // TAB 3: MENU ACCESS OPERATIONS
  // ============================================

  loadMenuAccess() {
    if (!this.selectedRoleId()) return;
    this.svc.getMenuAccess(this.selectedRoleId()).subscribe((m: any) => {
      this.menuAccess.set(m.data || m);
    });
  }

  onRoleChange(roleId: number) {
    this.selectedRoleId.set(roleId);
    this.loadMenuAccess();
  }

  toggleAll(menuId: number, checked: boolean) {
    this.menuAccess.update(list =>
      list.map(m => m.menuId === menuId
        ? { ...m, canView: checked, canCreate: checked, canEdit: checked, canDelete: checked }
        : m)
    );
  }

  togglePerm(menuId: number, perm: 'canView' | 'canCreate' | 'canEdit' | 'canDelete', val: boolean) {
    this.menuAccess.update(list =>
      list.map(m => m.menuId === menuId ? { ...m, [perm]: val } : m)
    );
  }

  saveAccess() {
    this.savingAccess.set(true);
    this.svc.saveMenuAccessBulk(this.selectedRoleId(), this.menuAccess()).subscribe(() => {
      this.savingAccess.set(false);
    });
  }

  // ============================================
  // TAB 4: COMPANY USERS OPERATIONS
  // ============================================

  openInviteModal() {
    this.showInviteModal.set(true);
    this.lookupUserEmail = '';
    this.inviteEmail = '';
    this.lookedUpUser = null;
    this.userNotFound = false;
    this.inviteRole = 'Technician';
    this.inviteRemarks = '';
    this.searchUserTerm.set('');
    this.searchResults.set([]);
    this.selectedInviteUser.set(null);
    this.showSearchResults.set(false);
  }

  closeInviteModal() {
    this.showInviteModal.set(false);
    this.selectedInviteUser.set(null);
    this.searchUserTerm.set('');
    this.searchResults.set([]);
    this.inviteEmail = '';
    this.inviteRole = 'Technician';
    this.inviteRemarks = '';
    this.lookupUserEmail = '';
    this.lookedUpUser = null;
    this.userNotFound = false;
    this.showSearchResults.set(false);
  }

onSearchUser() {
  const term = this.searchUserTerm()?.trim();

  if (!term) {
    this.searchResults.set([]);
    this.showSearchResults.set(false);
    return;
  }

  this.searchingUsers.set(true);
  this.showSearchResults.set(true);

  this.svc.searchUsers(term).subscribe({
    next: (res: any) => {
      this.searchingUsers.set(false);

      const users = Array.isArray(res?.data) ? res.data : [];

      this.searchResults.set(users);
    },
    error: () => {
      this.searchingUsers.set(false);
      this.searchResults.set([]);
    }
  });
}
  selectUser(user: UserDto) {
    this.selectedInviteUser.set(user);
    this.inviteEmail = user.email;
    this.searchUserTerm.set('');
    this.searchResults.set([]);
    this.showSearchResults.set(false);
    this.userNotFound = false;
    this.lookupUserEmail = user.email;
    this.lookedUpUser = user;
  }

  clearSelectedUser() {
    this.selectedInviteUser.set(null);
    this.inviteEmail = '';
    this.searchUserTerm.set('');
    this.lookupUserEmail = '';
    this.lookedUpUser = null;
  }

  lookupUserByEmail() {
    const email = this.lookupUserEmail;
    if (!email || !this.isValidEmail(email)) {
      alert('Please enter a valid email address');
      return;
    }

    this.isLookingUpUser = true;
    this.userNotFound = false;
    this.lookedUpUser = null;

    this.svc.checkUserExists(email).subscribe({
      next: (res: any) => {
        this.isLookingUpUser = false;
        const userData = res.data || res;
        if (userData && userData.exists) {
          const foundUser: UserDto = {
            userId: userData.userId,
            fullName: userData.fullName || 'User',
            email: email,
            mobileNumber: '',
            roleId: 0,
            roleName: '',
            isActive: true,
            createdAt: ''
          };
          this.lookedUpUser = foundUser;
          this.selectedInviteUser.set(foundUser);
          this.inviteEmail = email;
          this.userNotFound = false;
        } else {
          this.userNotFound = true;
        }
      },
      error: () => {
        this.isLookingUpUser = false;
        this.userNotFound = true;
      }
    });
  }

  sendInvitation() {
    const email = this.inviteEmail;
    const role = this.inviteRole;

    if (!email || !role) {
      alert('Please select a user and role');
      return;
    }

    this.svc.inviteUser(email, role, this.inviteRemarks).subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.closeInviteModal();
          this.loadPendingInvitations();
          this.loadCompanyUsers();
          alert('Invitation sent successfully!');
        } else {
          alert(res?.message || 'Failed to send invitation');
        }
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to send invitation');
      }
    });
  }

  loadCompanyUsers() {
    this.svc.getCompanyUsers().subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.companyUsers.set(res.data || []);
        } else if (Array.isArray(res)) {
          this.companyUsers.set(res);
        } else {
          this.companyUsers.set([]);
        }
      },
      error: (err) => {
        console.error('Error loading company users:', err);
        this.companyUsers.set([]);
      }
    });
  }

  loadPendingInvitations() {
    this.svc.getPendingInvitationsComp().subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.pendingInvitations.set(res.data || []);
        } else if (Array.isArray(res)) {
          this.pendingInvitations.set(res);
        } else {
          this.pendingInvitations.set([]);
        }
      },
      error: (err) => {
        console.error('Error loading invitations:', err);
        this.pendingInvitations.set([]);
      }
    });
  }

  updateUserRole(userParam: CompanyUserDetailDto | null, newRole: string | null): void {
    const user = userParam || this.selectedUser();
    if (!user) return;

    if (!newRole) {
      newRole = user.roleInCompany;
    }

    // Optimistic UI update
    this.companyUsers.update(list =>
      list.map(u =>
        u.userId === user.userId
          ? { ...u, roleInCompany: newRole! }
          : u
      )
    );

    this.svc.updateUserRole(user.userId, newRole).subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.showRoleModal.set(false);
          this.loadCompanyUsers();
        } else {
          alert(res?.message || 'Failed to update role');
          this.loadCompanyUsers(); // revert on failure
        }
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to update role');
        this.loadCompanyUsers(); // revert on failure
      }
    });
}

  removeUser(userId: number) {
    if (confirm('Are you sure you want to remove this user from the company?')) {
      this.svc.removeUserFromCompany(userId).subscribe({
        next: (res: any) => {
          if (res && res.success) {
            this.loadCompanyUsers();
            alert('User removed successfully');
          } else {
            alert(res?.message || 'Failed to remove user');
          }
        },
        error: (err) => {
          alert(err.error?.message || 'Failed to remove user');
        }
      });
    }
  }

  cancelInvitation(invitationId: number) {
    if (confirm('Cancel this invitation?')) {
      this.svc.cancelInvitation(invitationId).subscribe({
        next: () => {
          this.loadPendingInvitations();
          alert('Invitation cancelled');
        },
        error: (err) => {
          alert(err.error?.message || 'Failed to cancel invitation');
        }
      });
    }
  }

  // ============================================
  // TAB 5: JOIN REQUESTS OPERATIONS
  // ============================================

  loadPendingJoinRequests() {
    this.svc.getPendingJoinRequests().subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.pendingJoinRequests.set(res.data || []);
        } else if (Array.isArray(res)) {
          this.pendingJoinRequests.set(res);
        } else {
          this.pendingJoinRequests.set([]);
        }
      },
      error: (err) => {
        console.error('Error loading join requests:', err);
        this.pendingJoinRequests.set([]);
      }
    });
  }

  loadAvailableCompanies() {
    this.svc.getAllCompanies().subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.availableCompanies.set(res.data || []);
        } else if (Array.isArray(res)) {
          this.availableCompanies.set(res);
        } else {
          this.availableCompanies.set([]);
        }
      },
      error: (err) => {
        console.error('Error loading companies:', err);
        alert('Failed to load companies');
      }
    });
  }

  requestToJoinCompany(companyId: number) {
    if (!companyId || companyId === 0) {
      alert('Please select a company');
      return;
    }

    this.svc.createJoinRequest(companyId, this.requestedRole, this.requestRemarks).subscribe({
      next: (res: any) => {
        if (res && res.success) {
          alert('Join request sent successfully!');
          this.showRequestsModal.set(false);
          this.loadAvailableCompanies();
          this.requestedRole = 'Technician';
          this.requestRemarks = '';
          this.selectedCompanyId.set(0);
        } else {
          alert(res?.message || 'Failed to send request');
        }
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to send join request');
      }
    });
  }

  approveRequest(requestId: number) {
    if (confirm('Approve this join request?')) {
      this.svc.approveJoinRequest(requestId).subscribe({
        next: (res: any) => {
          if (res && res.success) {
            this.loadPendingJoinRequests();
            this.loadCompanyUsers();
            alert('Request approved! User added to company.');
          } else {
            alert(res?.message || 'Failed to approve request');
          }
        },
        error: (err) => {
          alert(err.error?.message || 'Failed to approve request');
        }
      });
    }
  }

  rejectRequest(requestId: number) {
    const reason = prompt('Enter rejection reason (optional):');
    this.svc.rejectJoinRequest(requestId, reason || '').subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.loadPendingJoinRequests();
          alert('Request rejected');
        } else {
          alert(res?.message || 'Failed to reject request');
        }
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to reject request');
      }
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
