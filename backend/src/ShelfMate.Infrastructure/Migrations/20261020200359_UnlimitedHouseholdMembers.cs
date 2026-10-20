using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShelfMate.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UnlimitedHouseholdMembers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Members_HouseholdId_Slot",
                table: "Members");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Member_Slot",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "Slot",
                table: "Members");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM "Members" GROUP BY "HouseholdId" HAVING COUNT(*) > 2) THEN
                        RAISE EXCEPTION 'Cannot restore two-member capacity while a household has more than two members.';
                    END IF;
                END $$;
                """);

            migrationBuilder.AddColumn<int>(
                name: "Slot",
                table: "Members",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("""
                WITH ranked AS (
                    SELECT "Id", ROW_NUMBER() OVER (
                        PARTITION BY "HouseholdId"
                        ORDER BY ("Role" = 'Owner') DESC, "JoinedAt", "Id"
                    ) AS slot
                    FROM "Members"
                )
                UPDATE "Members" AS member SET "Slot" = ranked.slot
                FROM ranked WHERE member."Id" = ranked."Id";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Members_HouseholdId_Slot",
                table: "Members",
                columns: new[] { "HouseholdId", "Slot" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Member_Slot",
                table: "Members",
                sql: "\"Slot\" IN (1, 2)");
        }
    }
}
