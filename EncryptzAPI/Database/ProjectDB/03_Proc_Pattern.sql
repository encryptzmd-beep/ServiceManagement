/* =============================================================================
   ProjectDB · Business stored-proc scoping pattern
   -----------------------------------------------------------------------------
   A service-app DB may be shared across companies/projects, so EVERY business
   proc filters/stamps by @CompanyId + @ProjectId + @LocationId. The API passes
   these from TenantContext (never from user input), so a user can only touch
   rows for the company/project/location they are scoped to.

   Example table: Customers. Apply the same shape to every business proc.
   ============================================================================= */

/* ---- READ (current company + project + location) ------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Customer_GetList
    @CompanyId  INT,
    @ProjectId  INT,
    @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT *
    FROM dbo.Customers
    WHERE CompanyId  = @CompanyId
      AND ProjectId  = @ProjectId
      AND LocationId = @LocationId;
END
GO

/* ---- WRITE (stamps CompanyId + ProjectId + LocationId) ------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Customer_Save
    @CompanyId   INT,
    @ProjectId   INT,
    @LocationId  INT,
    @CustomerId  INT = 0,
    @FullName    NVARCHAR(200),
    @MobileNumber NVARCHAR(20) = NULL
    -- ... other columns ...
AS
BEGIN
    SET NOCOUNT ON;

    IF @CustomerId = 0
    BEGIN
        INSERT INTO dbo.Customers (CompanyId, ProjectId, LocationId, FullName, MobileNumber /*, ...*/)
        VALUES (@CompanyId, @ProjectId, @LocationId, @FullName, @MobileNumber /*, ...*/);
        SELECT SCOPE_IDENTITY() AS CustomerId, 'Inserted' AS Status;
    END
    ELSE
    BEGIN
        UPDATE dbo.Customers
        SET FullName = @FullName, MobileNumber = @MobileNumber
        WHERE CustomerId = @CustomerId
          AND CompanyId  = @CompanyId     -- guard: never cross-company (shared DB safe)
          AND ProjectId  = @ProjectId     -- guard: never cross-project
          AND LocationId = @LocationId;   -- guard: never cross-location
        SELECT @CustomerId AS CustomerId, 'Updated' AS Status;
    END
END
GO
